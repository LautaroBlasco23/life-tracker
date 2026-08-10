package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment string
	Port        string
	GinMode     string

	// PostgreSQL Config
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// MongoDB Config
	MongoURI      string
	MongoDatabase string

	// JWT Config
	JWTSecret        string
	JWTExpiry        string
	JWTRefreshExpiry string

	// AWS Config
	AWSRegion      string
	AWSEndpointURL string
	S3Bucket       string
	S3PublicURL    string
	SecretsJWTName string
	AppRuntime     string

	CORSAllowedOrigins string
}

func Load() *Config {
	env := getEnv("ENVIRONMENT", "")
	if env == "" {
		env = "dev"
	}

	file := ".env"
	if env == "test" {
		file = ".env.test"
	}

	envPath := findEnvFile(file)
	if envPath != "" {
		if err := godotenv.Load(envPath); err != nil {
			log.Printf("Error loading %s: %v\n", envPath, err)
		}
	} else {
		log.Printf("No %s file found, using system environment variables\n", file)
	}

	mongoURI := getEnv("MONGO_URI", "")
	if mongoURI == "" {
		mongoHost := getEnv("MONGO_HOST", "localhost")
		mongoPort := getEnv("MONGO_PORT", "27017")
		mongoUser := getEnv("MONGO_USER", "admin")
		mongoPass := getEnv("MONGO_PASSWORD", "password")
		mongoURI = fmt.Sprintf(
			"mongodb://%s:%s@%s:%s",
			mongoUser, mongoPass, mongoHost, mongoPort,
		)
	}

	jwtSecret := getEnv("JWT_SECRET", "default-secret-change-this")

	s3Bucket := getEnv("S3_BUCKET", "lifetracker-images")
	awsRegion := getEnv("AWS_REGION", "us-east-1")
	awsEndpointURL := getEnv("AWS_ENDPOINT_URL", "")

	s3PublicURL := getEnv("S3_PUBLIC_URL", "")
	if s3PublicURL == "" {
		if awsEndpointURL != "" {
			s3PublicURL = "http://localhost:4566"
		} else {
			s3PublicURL = fmt.Sprintf("https://%s.s3.%s.amazonaws.com", s3Bucket, awsRegion)
		}
	}

	return &Config{
		Environment: env,
		Port:        getEnv("PORT", "8080"),
		GinMode:     getEnv("GIN_MODE", "debug"),

		// PostgreSQL
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "password"),
		DBName:     getEnv("DB_NAME", "golang_api"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		// MongoDB
		MongoURI:      mongoURI,
		MongoDatabase: getEnv("MONGO_DATABASE", "life_tracker"),

		// JWT
		JWTSecret:        jwtSecret,
		JWTExpiry:        getEnv("JWT_EXPIRY", "24h"),
		JWTRefreshExpiry: getEnv("JWT_REFRESH_EXPIRY", "168h"),

		// AWS
		AWSRegion:      awsRegion,
		AWSEndpointURL: awsEndpointURL,
		S3Bucket:       s3Bucket,
		S3PublicURL:    s3PublicURL,
		SecretsJWTName: getEnv("SECRETS_JWT_NAME", "life-tracker/jwt-secret"),
		AppRuntime:     getEnv("APP_RUNTIME", ""),

		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "*"),
	}
}

func findEnvFile(filename string) string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	for {
		path := filepath.Join(dir, filename)
		if _, err := os.Stat(path); err == nil {
			return path
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return ""
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
