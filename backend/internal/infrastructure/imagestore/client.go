package imagestore

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"life-tracker-backend/internal/aws"
	"life-tracker-backend/internal/config"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

const maxImageSize = 10 * 1024 * 1024

type Client struct {
	s3      *s3.Client
	bucket  string
	baseURL string
}

func NewClient(cfg *config.Config) (*Client, error) {
	awsCfg, err := aws.LoadConfig(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		// Path-style addressing is required by floci/LocalStack.
		o.UsePathStyle = true
	})

	return &Client{
		s3:      s3Client,
		bucket:  cfg.S3Bucket,
		baseURL: strings.TrimRight(cfg.S3PublicURL, "/"),
	}, nil
}

func (c *Client) UploadProfileImage(ctx context.Context, userID uint, imageData []byte, filename string) (string, string, error) {
	if err := validateImage(imageData, filename); err != nil {
		return "", "", err
	}

	key := fmt.Sprintf("users/%d/avatar", userID)

	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      awssdk.String(c.bucket),
		Key:         awssdk.String(key),
		Body:        bytes.NewReader(imageData),
		ContentType: awssdk.String(getContentType(filename)),
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to upload image to S3: %w", err)
	}

	url := fmt.Sprintf("%s/%s/%s", c.baseURL, c.bucket, key)
	return url, url, nil
}

func (c *Client) UploadNoteImage(ctx context.Context, userID uint, imageData []byte, filename string) (string, error) {
	if err := validateImage(imageData, filename); err != nil {
		return "", err
	}

	key := fmt.Sprintf("notes/%d/%s%s", userID, newObjectID(), strings.ToLower(filepath.Ext(filename)))

	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      awssdk.String(c.bucket),
		Key:         awssdk.String(key),
		Body:        bytes.NewReader(imageData),
		ContentType: awssdk.String(getContentType(filename)),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload image to S3: %w", err)
	}

	return fmt.Sprintf("%s/%s/%s", c.baseURL, c.bucket, key), nil
}

func (c *Client) DeleteImage(ctx context.Context, imageID string, userID string) error {
	key := fmt.Sprintf("users/%s/avatar", userID)

	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: awssdk.String(c.bucket),
		Key:    awssdk.String(key),
	})
	if err != nil {
		var notFound *types.NotFound
		if errors.As(err, &notFound) {
			return nil
		}
		return fmt.Errorf("failed to delete image from S3: %w", err)
	}

	return nil
}

func (c *Client) Close() error {
	return nil
}

// newObjectID returns a UUIDv4-shaped unique suffix for object keys, so each
// note image gets its own key (they are never overwritten, unlike avatars).
// crypto/rand.Read never returns an error (Go 1.24+), so none is propagated.
func newObjectID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func validateImage(imageData []byte, filename string) error {
	if len(imageData) > maxImageSize {
		return errors.New("file size exceeds 10MB limit")
	}

	ext := strings.ToLower(filepath.Ext(filename))
	allowedExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".webp": true,
	}
	if !allowedExts[ext] {
		return errors.New("invalid file type, only JPG, PNG, and WebP are allowed")
	}

	return nil
}

func getContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	contentTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".webp": "image/webp",
	}

	if ct, ok := contentTypes[ext]; ok {
		return ct
	}
	return "application/octet-stream"
}
