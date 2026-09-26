FROM alpine:3.20

RUN apk add --no-cache curl jq iproute2 bind-tools

COPY check-ip.sh /check-ip.sh
RUN chmod +x /check-ip.sh

ENTRYPOINT ["/check-ip.sh"]
