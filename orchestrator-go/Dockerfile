FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o orchestrator .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/orchestrator .
EXPOSE 9090
CMD ["./orchestrator"]
