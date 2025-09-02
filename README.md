# Trello Card Scheduler

**Current Version:** 1.0.0

The Trello Card Scheduler is a full-stack web application designed to automate the creation of recurring Trello cards. It provides a user-friendly interface for creating detailed schedules and a powerful backend scheduler to handle the card creation process automatically. The application features a complete authentication system with role-based access for regular users and administrators.

<img width="1668" height="1246" alt="TrelloCardSchedulerScreenshot" src="https://github.com/user-attachments/assets/d071ac88-ca55-4b2f-836d-28c9d4ce6e2e" />

## Major Features

### General Features:

* **Light & Dark Mode:** The application includes a theme toggle, allowing users to switch between a light and dark interface for their comfort.

### For All Users:

* **Secure Login:** Users can log in to the application with their credentials to access their schedules.
* **Scheduler Status View:** The main dashboard includes a real-time status panel that shows when the scheduler last ran, its duration, how many cards were created, and when the next run is scheduled.
* **Side-Panel Layout:** A modern, two-column layout with a persistent left sidebar for easy navigation and a main content area for focused tasks.
* **Categorized & Collapsible Schedule List:** Schedules are neatly organized into collapsible categories in the side panel.
* **Expandable Schedule Details:** Each schedule in the list can be expanded to show more details, including its full frequency, active dates, and a link to its active Trello card.
* **Toggle Schedules On/Off:** Schedules can be quickly activated or deactivated with a single click, allowing users to pause and resume recurring card creation without deleting the schedule.
* **Schedule Creation & Management:** Users can create, edit, and delete their own schedules with a detailed form that includes:
    * Title, description, and category.
    * Assignment to a specific Trello board member.
    * Complex recurring frequencies (daily, weekly, monthly, yearly) with specific time settings.
    * Optional start and end dates.
* **Manual Card Creation:** A "Create Now" button allows users to manually trigger the creation of a Trello card for any schedule, outside of its regular recurring timeline.
* **Clone Schedules:** Users can easily duplicate an existing schedule with a single click, making it fast and easy to create similar schedules.
* **Instant Feedback Notifications:** Receive real-time toast notifications for actions like creating, updating, or deleting schedules, providing immediate confirmation of your operations.

### For Administrators:

* **Admin-Only Navigation:** A dedicated "Admin" section in the sidebar provides access to all administrative features.
* **Dashboard & Statistics:** A dashboard page displays key application metrics, including total schedules, total cards created, and breakdowns of activity by user and category.
* **Application Settings with Trello Helpers:** A secure settings page allows administrators to configure the application's connection to the Trello API. The interface includes helpers to fetch and list available Trello boards and lists, simplifying the process of finding the correct IDs.
* **User Management:** Administrators have full control over user accounts, including the ability to:
    * Create new users with either 'admin' or 'user' roles.
    * Delete existing users.
    * Reset a user's password, which generates a new, secure temporary password.
* **Audit Log:** A detailed audit log provides a chronological record of all important events in the application, including user actions (like creating a schedule or deleting a user) and system events (like a scheduler run).
* **Role-Based Access Control (RBAC):** The application enforces a strict separation of permissions between 'admin' and 'user' roles, ensuring system security and data integrity.

## Technology Stack

The application is built with the following technologies:

### Backend
*   **Node.js:** A JavaScript runtime for the server-side environment.
*   **Express.js:** A minimal and flexible Node.js web application framework.
*   **PostgreSQL:** A powerful, open-source object-relational database system.
*   **JSON Web Tokens (JWT):** Used for creating secure authentication tokens.
*   **bcrypt.js:** A library for hashing passwords.
*   **node-cron:** A task scheduler for running background jobs.

### Frontend
*   **React:** A JavaScript library for building user interfaces.
*   **Tailwind CSS:** A utility-first CSS framework for rapid UI development.
*   **Axios:** A promise-based HTTP client for making requests to the backend.
*   **React Testing Library & Jest:** For component and unit testing.
*   **Cypress:** For end-to-end testing.

## Local Development Setup

To set up and run this project on your local machine, follow the steps below.

### Prerequisites

*   **Node.js & npm:** You must have Node.js (version 18 or higher is recommended) and npm installed.
*   **PostgreSQL:** A running instance of a PostgreSQL database is required.

### 1. Clone the Repository

First, clone the project from GitHub.
```bash
git clone <your-repository-url>
cd <repository-name>
```

### 2. Install Dependencies

The project uses a monorepo structure with dependencies at the root, backend, and frontend levels. Install all of them:

```bash
# Install root-level dependencies
npm install

# Install backend dependencies
npm install --prefix backend

# Install frontend dependencies
npm install --prefix frontend
```

### 3. Set Up Environment Variables

The backend requires a set of environment variables to connect to the database and manage security. You must export these variables in the shell session where you run the application.

For example, you can add these to your `.bashrc` or `.zshrc` file, or use a tool like `direnv`.

**Required Variables:**
```bash
# PostgreSQL Database Connection
export DB_HOST=localhost
export DB_USER=your_db_user
export DB_PASSWORD=your_db_password
export DB_NAME=trello_scheduler
export DB_PORT=5432

# JSON Web Token Secret
export JWT_SECRET=your_super_secret_random_string_for_jwt

# Optional: Initial Admin Credentials
# If not set, defaults to admin/changeme
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=a_secure_password_for_the_admin
```

### 4. Run the Application

Once all dependencies are installed and the environment variables are set, you can start the entire application (both backend and frontend) with a single command from the **root directory**:

```bash
npm run dev
```
This command will concurrently start the backend server in development mode (with `nodemon`) and the frontend React development server.

The frontend will be available at `http://localhost:3000`, and the backend API will be running on `http://localhost:5000`.

## Deployment with Docker

This application is designed to be deployed as a single Docker container.

### Building the Production Image

The `Dockerfile` for this project is configured to clone the latest version of the source code directly from the `main` branch on GitHub. This means you do not need to have the source code on your local machine to build the image.

To build the production-ready Docker image, run the following command:

```bash
docker build -t trello-card-scheduler .
```

**Note on Rebuilding:** Because the `Dockerfile` clones the repository, Docker's build cache will not automatically detect when new code has been pushed to GitHub. If you need to rebuild the image to get the latest updates, you must use the `--no-cache` flag to force a fresh clone of the repository.

```bash
docker build --no-cache -t trello-card-scheduler .
```

### Running the Container

To run the application, you must provide the following environment variables to the `docker run` command.

#### Required Environment Variables

* **Database Connection:**
    * `DB_HOST`: The hostname or IP address of your PostgreSQL database.
    * `DB_USER`: The username for the database connection.
    * `DB_PASSWORD`: The password for the database connection.
    * `DB_NAME`: The name of the database.
    * `DB_PORT`: The port your database is running on (defaults to `5432`).
* **JWT Secret:**
    * `JWT_SECRET`: A long, random, and secret string used to sign authentication tokens.
* **Timezone:**
    * `TZ`: The timezone for the scheduler to run in (e.g., `"America/New_York"`).

#### Optional Admin Credentials

* **`ADMIN_USERNAME`**: The username for the initial administrator account. If not provided, it defaults to `admin`.
* **`ADMIN_PASSWORD`**: The password for the initial administrator account. If not provided, it defaults to `changeme` and a warning will be logged. It is **highly recommended** to set this in a production environment.

#### Example `docker run` Command

```
docker run -d
-p 5000:5000
--name trello-card-scheduler
-e DB_HOST=your_database_host
-e DB_USER=your_db_user
-e DB_PASSWORD=your_db_password
-e DB_NAME=trelloScheduler
-e DB_PORT=5432
-e JWT_SECRET=your_super_secret_random_string
-e ADMIN_USERNAME=admin
-e ADMIN_PASSWORD=your_secure_admin_password
-e TZ="America/New_York"
trello-card-scheduler
```
