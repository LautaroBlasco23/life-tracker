package imagestore

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// fakeS3 emulates just enough S3 wire behavior for EnsureBucket: a bucket
// that may or may not exist, plus the three provisioning operations. It
// records the operation order so the test can assert the real-AWS semantics
// the AWS Emulator enforces (Block Public Access must be disabled before a
// public bucket policy is accepted).
type fakeS3 struct {
	mu      sync.Mutex
	created bool
	ops     []string
	policy  string
}

func (f *fakeS3) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	switch r.Method {
	case http.MethodHead:
		if !f.created {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	case http.MethodPut:
		switch {
		case r.URL.Query().Has("publicAccessBlock"):
			f.ops = append(f.ops, "public-access-block")
			w.WriteHeader(http.StatusOK)
		case r.URL.Query().Has("policy"):
			body, _ := io.ReadAll(r.Body)
			f.policy = string(body)
			f.ops = append(f.ops, "policy")
			w.WriteHeader(http.StatusOK)
		case r.URL.Path == "/"+c_bucket:
			if f.created {
				w.WriteHeader(http.StatusConflict)
				return
			}
			f.created = true
			f.ops = append(f.ops, "create")
			w.WriteHeader(http.StatusOK)
		default:
			// Object PUT. A nonexistent bucket answers NoSuchBucket.
			if !f.created {
				w.Header().Set("Content-Type", "application/xml")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>`))
				return
			}
			f.ops = append(f.ops, "put")
			w.WriteHeader(http.StatusOK)
		}
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

const c_bucket = "test-bucket"

func newTestClient(t *testing.T, serverURL string) *Client {
	t.Helper()
	awscfg := awssdk.Config{
		Region:      "us-east-1",
		Credentials: credentials.NewStaticCredentialsProvider("t", "s", ""),
	}
	s3Client := s3.NewFromConfig(awscfg, func(o *s3.Options) {
		o.UsePathStyle = true
		o.BaseEndpoint = awssdk.String(serverURL)
	})
	return &Client{s3: s3Client, bucket: c_bucket, baseURL: serverURL, provisioning: true}
}

func TestEnsureBucketProvisionsFreshBucket(t *testing.T) {
	fake := &fakeS3{}
	server := httptest.NewServer(fake)
	defer server.Close()

	client := newTestClient(t, server.URL)
	if err := client.EnsureBucket(context.Background()); err != nil {
		t.Fatalf("EnsureBucket: %v", err)
	}

	want := []string{"create", "public-access-block", "policy"}
	if len(fake.ops) != len(want) {
		t.Fatalf("operations = %v, want %v", fake.ops, want)
	}
	for i, op := range want {
		if fake.ops[i] != op {
			t.Fatalf("operation %d = %q, want %q (full order: %v)", i, fake.ops[i], op, fake.ops)
		}
	}

	// The policy must grant anonymous GetObject on the bucket's objects
	// (the app serves images through unauthenticated public URLs).
	wantResource := "arn:aws:s3:::" + c_bucket + "/*"
	if !strings.Contains(fake.policy, wantResource) {
		t.Errorf("policy %q missing resource %q", fake.policy, wantResource)
	}
	if !strings.Contains(fake.policy, `"Effect":"Allow"`) || !strings.Contains(fake.policy, `"Principal":"*"`) {
		t.Errorf("policy %q is not a public read grant", fake.policy)
	}
}

func TestEnsureBucketExistingBucketIsNoOp(t *testing.T) {
	fake := &fakeS3{created: true}
	server := httptest.NewServer(fake)
	defer server.Close()

	client := newTestClient(t, server.URL)
	if err := client.EnsureBucket(context.Background()); err != nil {
		t.Fatalf("EnsureBucket: %v", err)
	}
	if len(fake.ops) != 0 {
		t.Errorf("operations = %v, want none for an existing bucket", fake.ops)
	}
}

func TestEnsureBucketSurfacesTransportErrors(t *testing.T) {
	// A HEAD 500 (emulator unreachable / internal error) must surface as an
	// error, not be treated as "missing bucket".
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	if err := client.EnsureBucket(context.Background()); err == nil {
		t.Fatal("EnsureBucket with a 500ing S3 should fail")
	}
}

func TestUploadRecoversVanishedBucket(t *testing.T) {
	// The emulator keeps state in memory: after a restart the bucket is
	// gone (created=false) and the first PUT answers NoSuchBucket. The
	// upload must recover by provisioning the bucket and retrying once.
	fake := &fakeS3{}
	server := httptest.NewServer(fake)
	defer server.Close()

	client := newTestClient(t, server.URL)
	url, err := client.UploadNoteImage(context.Background(), 1, []byte("x"), "shot.png")
	if err != nil {
		t.Fatalf("UploadNoteImage after bucket loss: %v", err)
	}
	if !strings.Contains(url, c_bucket+"/notes/1/") {
		t.Errorf("unexpected url %q", url)
	}
	want := []string{"create", "public-access-block", "policy", "put"}
	if len(fake.ops) != len(want) {
		t.Fatalf("operations = %v, want %v", fake.ops, want)
	}
	for i, op := range want {
		if fake.ops[i] != op {
			t.Fatalf("operation %d = %q, want %q (full order: %v)", i, fake.ops[i], op, fake.ops)
		}
	}
}

func TestUploadWithoutProvisioningDoesNotRetry(t *testing.T) {
	// Against real AWS (provisioning disabled) a NoSuchBucket must surface
	// as an error, not silently create buckets.
	fake := &fakeS3{}
	server := httptest.NewServer(fake)
	defer server.Close()

	client := newTestClient(t, server.URL)
	client.provisioning = false
	if _, err := client.UploadNoteImage(context.Background(), 1, []byte("x"), "shot.png"); err == nil {
		t.Fatal("upload into a missing bucket should fail when provisioning is disabled")
	}
	if len(fake.ops) != 0 {
		t.Errorf("operations = %v, want none", fake.ops)
	}
}
