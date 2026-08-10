package aws

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
)

// LoadConfig builds a single AWS SDK config shared by all AWS-backed services.
// When AWS_ENDPOINT_URL is set (dev/floci) clients target the local emulator;
// when empty the same config targets real AWS.
func LoadConfig(ctx context.Context) (aws.Config, error) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "us-east-1"
	}

	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	if accessKey == "" {
		accessKey = "test"
	}
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	if secretKey == "" {
		secretKey = "test"
	}

	opts := []func(*config.LoadOptions) error{
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"",
		)),
	}

	if endpoint := os.Getenv("AWS_ENDPOINT_URL"); endpoint != "" {
		opts = append(opts, config.WithBaseEndpoint(endpoint))
	}

	return config.LoadDefaultConfig(ctx, opts...)
}
