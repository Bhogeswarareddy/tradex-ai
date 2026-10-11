FROM nginx:alpine

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -k -f https://localhost/api/health || curl -f http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

