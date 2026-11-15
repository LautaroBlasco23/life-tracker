"""LocalStack ready hook: create the app's S3 image bucket if it is missing.

Runs inside the localstack container after the S3 service is up (mounted at
/etc/localstack/init/ready.d/init-s3.py, see the `localstack` profile in
docker-compose.yml). Credentials are irrelevant to LocalStack but boto3
requires something.
"""

import os

import boto3

bucket = os.environ.get("S3_BUCKET", "lifetracker-images")
region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

s3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:4566",
    region_name=region,
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

existing = [b["Name"] for b in s3.list_buckets()["Buckets"]]
if bucket in existing:
    print(f"localstack bucket already exists: {bucket}")
else:
    if region == "us-east-1":
        s3.create_bucket(Bucket=bucket)
    else:
        s3.create_bucket(
            Bucket=bucket,
            CreateBucketConfiguration={"LocationConstraint": region},
        )
    print(f"created localstack bucket: {bucket}")
