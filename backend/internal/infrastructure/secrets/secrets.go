package secrets

import (
	"context"
	"fmt"
	"log"

	"life-tracker-backend/internal/aws"
	"life-tracker-backend/internal/config"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

const defaultJWTSecret = "default-secret-change-this"

// LoadJWTSecret resolves the JWT secret: env wins in local dev, otherwise the
// value is fetched from AWS Secrets Manager. In prod a failed lookup is fatal;
// elsewhere it falls back to the env value with a warning.
func LoadJWTSecret(ctx context.Context, cfg *config.Config, existing string) (string, error) {
	if existing != "" && existing != defaultJWTSecret {
		return existing, nil
	}

	awsCfg, err := aws.LoadConfig(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	sm := secretsmanager.NewFromConfig(awsCfg)
	out, err := sm.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: awssdk.String(cfg.SecretsJWTName),
	})
	if err != nil {
		if cfg.Environment == "prod" {
			return "", fmt.Errorf("failed to fetch JWT secret from Secrets Manager: %w", err)
		}
		log.Printf("warning: failed to fetch JWT secret from Secrets Manager, falling back to env: %v", err)
		return existing, nil
	}

	if out.SecretString == nil || *out.SecretString == "" {
		if cfg.Environment == "prod" {
			return "", fmt.Errorf("JWT secret from Secrets Manager is empty")
		}
		log.Println("warning: JWT secret from Secrets Manager is empty, falling back to env")
		return existing, nil
	}

	return *out.SecretString, nil
}
