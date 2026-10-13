package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/auth/dto"
	"life-tracker-backend/internal/domain/auth/model"
	"life-tracker-backend/internal/domain/auth/repository"
	"life-tracker-backend/internal/infrastructure/monitoring"

	userModel "life-tracker-backend/internal/domain/user/model"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	authRepo repository.AuthRepository
	userRepo repository.UserRepository
	cfg      *config.Config
}

// bcryptCost 12 balances login latency (~250ms) against GPU cracking speed.
const bcryptCost = 12

type JWTClaims struct {
	jwt.RegisteredClaims
	Email  string `json:"email"`
	Type   string `json:"type"`
	UserID uint   `json:"userId"`
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{
		authRepo: repository.NewAuthRepository(db),
		userRepo: repository.NewUserRepository(db),
		cfg:      cfg,
	}
}

func (s *AuthService) Register(req *dto.RegisterRequest) (*dto.TokenResponse, uint, error) {
	// Validate username format (lowercase letters, digits, underscores only)
	matched, err := regexp.MatchString(`^[a-z0-9_]{3,30}$`, strings.ToLower(req.Username))
	if err != nil {
		return nil, 0, errors.New("failed to validate username")
	}
	if !matched {
		return nil, 0, errors.New("username must be 3-30 characters: lowercase letters, digits, underscores only")
	}

	exists, err := s.authRepo.EmailExists(req.Email)
	if err != nil {
		slog.Error("register: email exists check failed", "error", err)
		monitoring.AuthAttempts.WithLabelValues("failure").Inc()
		return nil, 0, errors.New("registration failed")
	}
	if exists {
		monitoring.AuthAttempts.WithLabelValues("failure").Inc()
		return nil, 0, errors.New("user already exists")
	}

	usernameExists, err := s.authRepo.UsernameExists(req.Username)
	if err != nil {
		slog.Error("register: username exists check failed", "error", err)
		return nil, 0, errors.New("registration failed")
	}
	if usernameExists {
		return nil, 0, errors.New("username already taken")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, 0, err
	}

	user := &userModel.User{
		FirstName: req.FirstName,
		LastName:  req.LastName,
	}

	if err = s.userRepo.Create(user); err != nil {
		slog.Error("register: user create failed", "error", err)
		return nil, 0, errors.New("registration failed")
	}

	auth := &model.Auth{
		Email:        req.Email,
		Username:     strings.ToLower(req.Username),
		PasswordHash: string(hashedPassword),
		UserID:       user.ID,
	}

	if err = s.authRepo.Create(auth); err != nil {
		slog.Error("register: auth create failed", "error", err)
		return nil, 0, errors.New("registration failed")
	}

	monitoring.UserRegistrations.Inc()
	monitoring.ActiveUsers.Inc()
	monitoring.AuthAttempts.WithLabelValues("success").Inc()

	slog.Info("user registered",
		"event", "USER_CREATED",
		"user_id", user.ID,
		"username", auth.Username,
	)

	tokens, err := s.generateTokens(user.ID, req.Email)
	if err != nil {
		return nil, 0, err
	}

	return tokens, user.ID, nil
}

func (s *AuthService) Login(req *dto.LoginRequest) (*dto.TokenResponse, uint, error) {
	var auth *model.Auth
	var err error

	// Check if identifier is an email or username
	if strings.Contains(req.Identifier, "@") {
		// Login by email
		auth, err = s.authRepo.FindByEmail(req.Identifier)
	} else {
		// Login by username
		auth, err = s.authRepo.FindByUsername(strings.ToLower(req.Identifier))
	}

	if err != nil {
		if errors.Is(err, repository.ErrAuthNotFound) {
			monitoring.AuthAttempts.WithLabelValues("failure").Inc()
			return nil, 0, errors.New("invalid credentials")
		}
		slog.Error("login: lookup failed", "error", err)
		return nil, 0, errors.New("login failed")
	}

	if err = bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(req.Password)); err != nil {
		monitoring.AuthAttempts.WithLabelValues("failure").Inc()
		return nil, 0, errors.New("invalid credentials")
	}

	monitoring.AuthAttempts.WithLabelValues("success").Inc()

	tokens, err := s.generateTokens(auth.UserID, auth.Email)
	if err != nil {
		return nil, 0, err
	}

	return tokens, auth.UserID, nil
}

func (s *AuthService) RefreshToken(refreshToken string) (*dto.TokenResponse, error) {
	claims, err := s.validateToken(refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	if claims.Type != "refresh" {
		return nil, errors.New("invalid token type")
	}

	// Server-side check: the token must exist unrevoked in the store. This is
	// what makes password/email changes able to kill existing sessions.
	if _, err := s.authRepo.FindValidRefreshToken(hashToken(refreshToken)); err != nil {
		return nil, errors.New("invalid refresh token")
	}

	monitoring.TokenRefreshes.Inc()

	// Rotate: revoke the presented token, then issue a new pair (the new
	// refresh token is stored inside generateTokens).
	if err := s.authRepo.RevokeRefreshToken(hashToken(refreshToken)); err != nil {
		return nil, errors.New("invalid refresh token")
	}

	return s.generateTokens(claims.UserID, claims.Email)
}

func (s *AuthService) Logout(refreshToken string, userID uint) error {
	if refreshToken != "" {
		// Best-effort revoke of the presented token; ignore "not found".
		if err := s.authRepo.RevokeRefreshToken(hashToken(refreshToken)); err != nil {
			slog.Warn("logout: could not revoke refresh token", "error", err)
		}
		return nil
	}
	// No token presented: revoke every session for this user.
	return s.authRepo.RevokeAllRefreshTokens(userID)
}

func (s *AuthService) generateTokens(userID uint, email string) (*dto.TokenResponse, error) {
	accessExpiry, err := time.ParseDuration(s.cfg.JWTExpiry)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT expiry duration: %w", err)
	}
	refreshExpiry, err := time.ParseDuration(s.cfg.JWTRefreshExpiry)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT refresh expiry duration: %w", err)
	}

	now := time.Now()

	// Unique token ID so tokens minted within the same second for the same
	// user are never identical (the refresh store has a unique hash index).
	jti, err := randomJTI()
	if err != nil {
		return nil, fmt.Errorf("failed to generate token id: %w", err)
	}

	accessClaims := &JWTClaims{
		UserID: userID,
		Email:  email,
		Type:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			ExpiresAt: jwt.NewNumericDate(now.Add(accessExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	refreshClaims := &JWTClaims{
		UserID: userID,
		Email:  email,
		Type:   "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        randomJTIDerived(jti),
			ExpiresAt: jwt.NewNumericDate(now.Add(refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	// Persist the refresh token (hashed) so sessions are revocable server-side.
	if err := s.authRepo.CreateRefreshToken(userID, hashToken(refreshTokenString), now.Add(refreshExpiry)); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &dto.TokenResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int64(accessExpiry.Seconds()),
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) validateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		// Pin the algorithm: never let a token's own header choose it.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok || t.Header["alg"] != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func (s *AuthService) UpdatePassword(userID uint, req *dto.UpdatePasswordRequest) (*dto.TokenResponse, error) {
	auth, err := s.authRepo.FindByUserID(userID)
	if err != nil {
		slog.Error("update password: find user failed", "error", err)
		return nil, errors.New("password update failed")
	}

	if err = bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return nil, errors.New("current password is incorrect")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		slog.Error("update password: hash failed", "error", err)
		return nil, errors.New("password update failed")
	}

	if err := s.authRepo.UpdatePassword(userID, string(hashedPassword)); err != nil {
		slog.Error("update password: update failed", "error", err)
		return nil, errors.New("password update failed")
	}

	// Revoke every refresh token: all sessions must re-authenticate after a
	// password change. The fresh pair returned below keeps the current device
	// signed in; every other device is signed out.
	if err := s.authRepo.RevokeAllRefreshTokens(userID); err != nil {
		slog.Error("update password: revoke sessions failed", "error", err)
		return nil, errors.New("password update failed")
	}

	monitoring.PasswordChanges.Inc()

	return s.generateTokens(userID, auth.Email)
}

func (s *AuthService) UpdateEmail(userID uint, req *dto.UpdateEmailRequest) (*dto.TokenResponse, error) {
	auth, err := s.authRepo.FindByUserID(userID)
	if err != nil {
		slog.Error("update email: find user failed", "error", err)
		return nil, errors.New("email update failed")
	}

	if err = bcrypt.CompareHashAndPassword([]byte(auth.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("password is incorrect")
	}

	if auth.Email == req.NewEmail {
		return nil, errors.New("new email is the same as current email")
	}

	exists, err := s.authRepo.EmailExists(req.NewEmail)
	if err != nil {
		slog.Error("update email: email exists check failed", "error", err)
		return nil, errors.New("email update failed")
	}
	if exists {
		return nil, errors.New("email already in use")
	}

	if err = s.authRepo.UpdateEmail(userID, req.NewEmail); err != nil {
		slog.Error("update email: update failed", "error", err)
		return nil, errors.New("email update failed")
	}

	// Revoke every refresh token issued for the previous email identity; the
	// new token pair below is stored against the updated identity.
	if err := s.authRepo.RevokeAllRefreshTokens(userID); err != nil {
		slog.Error("update email: revoke sessions failed", "error", err)
		return nil, errors.New("email update failed")
	}

	monitoring.EmailChanges.Inc()

	return s.generateTokens(userID, req.NewEmail)
}

// hashToken derives the stored representation of a refresh token. A plain
// SHA-256 is sufficient here: refresh tokens are high-entropy random JWTs, so
// there is no low-entropy value to brute force.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// randomJTI returns a fresh random token ID (jti) for a token pair.
func randomJTI() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// randomJTIDerived gives the paired token a distinct jti so two tokens of one
// login are still unique even though they share the same issue moment.
func randomJTIDerived(base string) string {
	sum := sha256.Sum256([]byte(base + ":refresh"))
	return hex.EncodeToString(sum[:16])
}
