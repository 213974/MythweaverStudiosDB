# Start with a secure and minimal Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files to leverage Docker's build cache
COPY package*.json ./

# Install production dependencies, INCLUDING axios and cheerio
RUN npm install --production

# Copy the rest of your application's source code
COPY . .

# The command to start your bot directly with Node. Note the 'src/' path.
CMD [ "node", "src/index.js" ]