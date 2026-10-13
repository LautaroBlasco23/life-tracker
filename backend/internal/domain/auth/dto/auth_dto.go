package dto

type LoginRequest struct {
	Identifier string `json:"identifier" binding:"required,min=3,max=255"`
	Password   string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Email string `json:"email" binding:"required,email"`
	// max=72: bcrypt silently truncates beyond 72 bytes; bound the input so
	// the stored hash always corresponds to the password the user typed.
	Password  string `json:"password" binding:"required,min=8,max=72"`
	FirstName string `json:"firstName" binding:"required,min=2,max=50"`
	LastName  string `json:"lastName" binding:"required,min=2,max=50"`
	Username  string `json:"username" binding:"required,min=3,max=30"`
}

type TokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	TokenType    string `json:"tokenType"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	// max=72: mirror RegisterRequest (bcrypt 72-byte truncation).
	NewPassword string `json:"newPassword" binding:"required,min=8,max=72"`
}

type UpdateEmailRequest struct {
	Password string `json:"password" binding:"required"`
	NewEmail string `json:"newEmail" binding:"required,email"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refreshToken" binding:"omitempty"`
}
