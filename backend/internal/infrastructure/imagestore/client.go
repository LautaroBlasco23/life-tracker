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
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
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

// EnsureBucket provisions the image bucket when the backend targets a local
// S3 emulator (AWS_ENDPOINT_URL set): create it if missing, disable Block
// Public Access, and attach the public-read GetObject policy the app's
// unauthenticated image URLs rely on. The AWS Emulator enforces real S3
// semantics — a fresh bucket has Block Public Access on, which makes
// PutBucketPolicy with a public principal fail — so all three steps are
// needed before the browser can fetch any uploaded object.
//
// Only the dev/emulator lane calls this (AWS_ENDPOINT_URL is empty against
// real AWS, where the bucket and its policy are provisioned outside the app).
func (c *Client) EnsureBucket(ctx context.Context) error {
	_, err := c.s3.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: awssdk.String(c.bucket)})
	if err == nil {
		return nil
	}

	var notFound *types.NotFound
	isMissing := errors.As(err, &notFound)
	if !isMissing {
		var respErr *awshttp.ResponseError
		isMissing = errors.As(err, &respErr) && respErr.HTTPStatusCode() == 404
	}
	if !isMissing {
		return fmt.Errorf("failed to check image bucket %q: %w", c.bucket, err)
	}

	if _, err := c.s3.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: awssdk.String(c.bucket)}); err != nil {
		var alreadyExists *types.BucketAlreadyExists
		var ownedByYou *types.BucketAlreadyOwnedByYou
		if !errors.As(err, &alreadyExists) && !errors.As(err, &ownedByYou) {
			return fmt.Errorf("failed to create image bucket %q: %w", c.bucket, err)
		}
	}

	// Block Public Access is on for fresh buckets (real-AWS semantics) and
	// blocks public bucket policies, so it must be disabled first.
	if _, err := c.s3.PutPublicAccessBlock(ctx, &s3.PutPublicAccessBlockInput{
		Bucket: awssdk.String(c.bucket),
		PublicAccessBlockConfiguration: &types.PublicAccessBlockConfiguration{
			BlockPublicAcls:       awssdk.Bool(false),
			IgnorePublicAcls:      awssdk.Bool(false),
			BlockPublicPolicy:     awssdk.Bool(false),
			RestrictPublicBuckets: awssdk.Bool(false),
		},
	}); err != nil {
		return fmt.Errorf("failed to disable Block Public Access on %q: %w", c.bucket, err)
	}

	// The app serves uploaded images through unauthenticated public URLs
	// (same contract as avatars today), so anonymous GetObject must be
	// allowed. Writes stay authenticated.
	policy := fmt.Sprintf(publicReadPolicyTemplate, c.bucket)
	if _, err := c.s3.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
		Bucket: awssdk.String(c.bucket),
		Policy: awssdk.String(policy),
	}); err != nil {
		return fmt.Errorf("failed to attach public-read policy to %q: %w", c.bucket, err)
	}

	return nil
}

const publicReadPolicyTemplate = `{"Version":"2012-10-17","Statement":[{"Sid":"PublicReadGetObject","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::%s/*"}]}`

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
	// crypto/rand.Read cannot fail, but errcheck (check-blank) rejects the
	// blank assignment; a panic is the honest no-op handler.
	if _, err := rand.Read(b[:]); err != nil {
		panic(fmt.Sprintf("crypto/rand.Read failed: %v", err))
	}
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
