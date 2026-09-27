# --- build stage ---
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /hemio .

# --- run stage ---
FROM alpine:3.20
RUN addgroup -S hemio && adduser -S hemio -G hemio
COPY --from=build /hemio /usr/local/bin/hemio
USER hemio
ENV HEMIO_DATA_DIR=/data
ENV HEMIO_PORT=8090
VOLUME /data
EXPOSE 8090
ENTRYPOINT ["hemio"]
