package model

import (
	"time"

	"gorm.io/gorm"
)

type Auth struct {
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
	Email        string         `json:"email" gorm:"uniqueIndex;not null"`
	Username     string         `json:"username" gorm:"uniqueIndex;not null;size:64"`
	PasswordHash string         `json:"-" gorm:"not null"`
	ID           uint           `json:"id" gorm:"primaryKey"`
	UserID       uint           `json:"userId" gorm:"not null"`
}

// RefreshToken is the server-side record of an issued refresh token. Only a
// SHA-256 hash of the token is stored; the raw token exists solely in the
// client. A token is valid while revoked_at IS NULL and expires_at is in the
// future, which makes password/email changes able to revoke every session.
type RefreshToken struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	UserID    uint       `json:"userId" gorm:"not null;index"`
	TokenHash string     `json:"-" gorm:"uniqueIndex;size:64;not null"`
	ExpiresAt time.Time  `json:"expiresAt" gorm:"not null"`
	RevokedAt *time.Time `json:"revokedAt"`
	CreatedAt time.Time  `json:"createdAt"`
}
