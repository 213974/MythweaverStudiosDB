# Start with an official Node.js image. Using a specific version is good practice.
# The "-alpine" variant is smaller and more secure.
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker's layer caching.
# This way, dependencies are only re-installed if these files change.
COPY package*.json ./

# Install only the production dependencies specified in package.json
RUN npm install --production

# Install PM2 globally within the container
RUN npm install pm2 -g

# Copy the rest of your application's source code into the image
COPY . .

# The command to start your application using pm2-runtime.
# pm2-runtime is designed for containerized environments to keep the process in the foreground.
CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]