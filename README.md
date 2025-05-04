# E-Commerce_Backend
 Backend Repo for the Distributed Information Systems Project (CSE474)
# E-Commerce Microservices Backend

A robust, scalable microservices-based e-commerce backend platform built with Node.js, Express, MongoDB, Docker, and Kubernetes.

![Microservices Architecture](https://via.placeholder.com/800x400?text=E-Commerce+Microservices+Architecture)

## Architecture Overview

This project implements a complete e-commerce backend using a microservices architecture:

1.  **Auth Service** - User authentication and authorization
2.  **Product Service** - Product catalog and inventory management
3.  **Order Service** - Order processing and payment integration

Each service is independently deployable, scalable, and maintainable with its own database and API.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16+)
-   [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/)
-   [MongoDB Atlas Account](https://www.mongodb.com/cloud/atlas) or local MongoDB installation
-   [Kubernetes](https://kubernetes.io/) (for production deployment)
-   [kubectl](https://kubernetes.io/docs/tasks/tools/) command line tool

### Local Development Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/E-Commerce_Backend.git
    cd E-Commerce_Backend
    ```

2.  Create a `.env` file in each service directory:

    **Auth Service** (`/auth-service/.env`):
    ```
    PORT=3000
    MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/auth
    JWT_SECRET=your-jwt-secret-key
    GOOGLE_CLIENT_ID=your-google-client-id
    GOOGLE_CLIENT_SECRET=your-google-client-secret
    FACEBOOK_APP_ID=your-facebook-app-id
    FACEBOOK_APP_SECRET=your-facebook-app-secret
    FRONTEND_URL=http://localhost:3000
    ```

    **Product Service** (`/product-service/.env`):
    ```
    PORT=4000
    MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/products
    AUTH_SERVICE_URL=http://localhost:3000
    ```

    **Order Service** (`/order-service/.env`):
    ```
    PORT=3002
    MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/orders
    AUTH_SERVICE_URL=http://localhost:3000
    PRODUCT_SERVICE_URL=http://localhost:4000
    PAYMOB_API_KEY=your-paymob-api-key
    PAYMOB_INTEGRATION_ID=your-paymob-integration-id
    PAYMOB_IFRAME_ID=your-paymob-iframe-id
    ```

3.  Install dependencies for each service:
    ```bash
    cd auth-service && npm install
    cd ../product-service && npm install
    cd ../order-service && npm install
    ```

4.  Run services in development mode:
    ```bash
    # Terminal 1
    cd auth-service && npm run dev

    # Terminal 2
    cd product-service && npm run dev

    # Terminal 3
    cd order-service && npm run dev
    ```

## Docker Deployment

For a containerized development or staging environment:

1.  Update the environment variables in the `docker-compose.yml` file (use provided template values)

2.  Build and start all services with Docker Compose:
    ```bash
    docker-compose up --build
    ```

3.  Access the services:
    -   Auth Service: http://localhost:3000
    -   Product Service: http://localhost:4000
    -   Order Service: http://localhost:3002

## Kubernetes Deployment

For production-grade deployment using Kubernetes:

1.  Create the necessary Kubernetes secrets:

    ```bash
    # Encode your secrets
    echo -n 'mongodb+srv://username:password@cluster.mongodb.net/auth' | base64
    # Use the output in your secrets.yaml file
    ```

2.  Apply the Kubernetes configuration files:
    ```bash
    kubectl apply -f kubernetes/secrets.yaml
    kubectl apply -f kubernetes/auth-deployment.yaml
    kubectl apply -f kubernetes/product-deployment.yaml
    kubectl apply -f kubernetes/order-deployment.yaml
    ```

3.  Check deployment status:
    ```bash
    kubectl get pods
    kubectl get services
    ```

4.  For external access, you can expose services using an Ingress controller or LoadBalancer.

## Secrets Management

This project requires several secrets for operation:

### MongoDB Connection Strings

Create databases on MongoDB Atlas or use a local MongoDB instance:
-   Auth Service: `mongodb+srv://<username>:<password>@cluster.mongodb.net/auth`
-   Product Service: `mongodb+srv://<username>:<password>@cluster.mongodb.net/products`
-   Order Service: `mongodb+srv://<username>:<password>@cluster.mongodb.net/orders`

### JWT Authentication

Generate a secure random string for the JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### OAuth Configuration

1.  **Google OAuth**:
    -   Create a project in [Google Cloud Console](https://console.cloud.google.com/)
    -   Configure OAuth consent screen
    -   Create OAuth client credentials
    -   Add authorized redirect URIs (e.g., `http://localhost:3000/api/auth/google/callback`)

2.  **Facebook OAuth**:
    -   Create an app in [Facebook Developers](https://developers.facebook.com/)
    -   Set up Facebook Login
    -   Add authorized redirect URIs

### Payment Integration (PayMob)

1.  Register for a [PayMob account](https://paymob.com/)
2.  Create an API key
3.  Set up an integration and note your integration ID
4.  Configure your iframe ID for the payment form

## API Documentation

### Auth Service (Port 3000)

| Endpoint                    | Method | Description                         |
|-----------------------------|--------|-------------------------------------|
| `/api/auth/register`        | POST   | Register a new user                 |
| `/api/auth/login`           | POST   | Log in with email/password          |
| `/api/auth/me`              | GET    | Get authenticated user's info       |
| `/api/auth/google`          | GET    | Initiate Google OAuth login         |
| `/api/auth/facebook`        | GET    | Initiate Facebook OAuth login       |

### Product Service (Port 4000)

| Endpoint                         | Method | Description                   |
|----------------------------------|--------|-------------------------------|
| `/api/products`                  | GET    | List all products             |
| `/api/products`                  | POST   | Create a new product          |
| `/api/products/:id`              | GET    | Get product details           |
| `/api/products/:id`              | PUT    | Update product                |
| `/api/products/:id`              | DELETE | Delete product                |
| `/api/products/:id/stock`        | PATCH  | Update product stock          |
| `/api/products/inventory/low-stock` | GET | Get low stock products        |

### Order Service (Port 3002)

| Endpoint                         | Method | Description                   |
|----------------------------------|--------|-------------------------------|
| `/api/orders`                    | POST   | Create a new order            |
| `/api/orders`                    | GET    | Get all orders (admin only)   |
| `/api/orders/myorders`           | GET    | Get user's orders             |
| `/api/orders/:id`                | GET    | Get order details             |
| `/api/orders/:id/status`         | PUT    | Update order status           |
| `/api/orders/:id/pay`            | PUT    | Update order to paid status   |
| `/api/orders/:id/pay/paymob`     | POST   | Create PayMob payment         |
| `/api/orders/paymob-callback`    | POST   | PayMob payment callback       |

## Inter-Service Communication

Services communicate via REST APIs:
-   Auth service validates tokens for Product and Order services
-   Order service calls Product service to check inventory and update stock

## Testing

Each service includes unit and integration tests:

```bash
cd auth-service && npm test
cd product-service && npm test
cd order-service && npm test
```

## Development Workflow

1.  **Feature Development**:
    -   Create a branch: `git checkout -b feature/your-feature`
    -   Implement and test your changes
    -   Submit a PR for review

2.  **CI/CD Pipeline** (conceptual):
    -   Code linting and testing
    -   Docker image building and pushing
    -   Kubernetes deployment updates

## Monitoring and Scaling

-   Each service includes a `/health` endpoint for monitoring
-   Services can be individually scaled in Kubernetes:
    ```bash
    kubectl scale deployment auth-service --replicas=3
    ```

## Troubleshooting

**Problem**: Services can't communicate with each other
**Solution**: Verify service discovery settings and network policies

**Problem**: MongoDB connection fails
**Solution**: Ensure MongoDB URI is correct and network allows connections

**Problem**: Authorization fails between services
**Solution**: Verify JWT settings across services match

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Contact

Project Maintainer - email@example.com

---

Built with ❤️ and ☕