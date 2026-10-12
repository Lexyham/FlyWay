PROJECT OVERVIEW

This is a full-stack flight booking and tracking system that combines multiple functionalities into one platform. It includes a simulated flight engine, booking and payment system, user accounts with dashboards, a hidden admin control panel, and gamified visual flight experiences such as maps and simulations.

The system is built primarily using Node.js, Vanilla JavaScript, HTML, and JSON-based storage instead of a traditional database.

The Docker Compose deployment runs FlyWay and Ollama as separate containers on a private Compose network. Compose sets `OLLAMA_URL` to `http://ollama:11434`, 

For a local Compose deployment, copy `.env.example` to `.env`, replace `JWT_SECRET`, and run:

```sh
docker compose up --build -d
docker compose logs -f ollama-model flyway
```
Zephyr uses `http://127.0.0.1:11434` by default. Install Ollama, run `ollama pull llama3.2:3b``node --test test/zephyrAiService.test.js`.