FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create SSL directory (certs mounted at runtime via docker-compose)
RUN mkdir -p /etc/nginx/ssl

EXPOSE 8000 8443
