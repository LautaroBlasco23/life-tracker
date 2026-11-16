FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal

# Official AWS Emulator (https://github.com/aws/aws-emulator): a local
# emulator of the AWS APIs used for the image-upload lane. AWS publishes no
# image; this installs their Linux RPM per their Docker docs. The RPM URL is
# the LTS "latest" channel — rebuilds occasionally pick up a new version.
ADD https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-x86_64.rpm /tmp/aws-emulator.rpm

RUN rpm -i /tmp/aws-emulator.rpm && rm /tmp/aws-emulator.rpm \
    && dnf -y install curl-minimal \
    && mkdir -p /home/emulator && chown 1000:1000 /home/emulator

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER 1000:1000
ENV HOME=/home/emulator
EXPOSE 9297

# --auth off: the lane accepts unsigned requests (the browser fetches image
# URLs anonymously); loopback-published only in docker-compose.yml.
# --telemetry off: usage reporting is opt-out; this lane opts out.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["-b", "0.0.0.0", "--auth", "off", "--telemetry", "off", "-p", "9297"]
