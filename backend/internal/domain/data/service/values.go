package service

import (
	"fmt"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// ---- encoding (Go -> sheet cell, always a string) ----

func encTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

func encOptionalTime(t gorm.DeletedAt) string {
	if !t.Valid {
		return ""
	}
	return encTime(t.Time)
}

func encBool(b bool) string {
	return strconv.FormatBool(b)
}

func encUint(u uint) string {
	return strconv.FormatUint(uint64(u), 10)
}

func encInt(i int) string {
	return strconv.Itoa(i)
}

func encFloat(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

func encObjectID(id primitive.ObjectID) string {
	return id.Hex()
}

// ---- decoding (sheet cell string -> Go value) ----

func decTime(s string) (time.Time, error) {
	return time.Parse(time.RFC3339Nano, s)
}

func decBool(s string) (bool, error) {
	b, err := strconv.ParseBool(s)
	if err != nil {
		return false, fmt.Errorf("invalid boolean %q", s)
	}
	return b, nil
}

func decUint(s string) (uint, error) {
	u, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid id %q", s)
	}
	return uint(u), nil
}

func decInt(s string) (int, error) {
	i, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("invalid number %q", s)
	}
	return i, nil
}

func decFloat(s string) (float64, error) {
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid number %q", s)
	}
	return f, nil
}

func decObjectID(s string) (primitive.ObjectID, error) {
	id, err := primitive.ObjectIDFromHex(s)
	if err != nil {
		return primitive.NilObjectID, fmt.Errorf("invalid id %q", s)
	}
	return id, nil
}
