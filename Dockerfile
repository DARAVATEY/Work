# Step 1: Build the React app
FROM node:20 as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Serve with Nginx
FROM nginx:alpine
# Copy the built files from Vite
COPY --from=build /app/dist /usr/share/nginx/html
# Copy a custom nginx config to handle React routing
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
