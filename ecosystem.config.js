module.exports = {
  apps: [
    {
      name: "job-scheduler-api",
      script: "node",
      args: "dist/index.js",
      cwd: "/var/www/job_scheduler/current",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "job-scheduler-worker",
      script: "node",
      args: "dist/worker/index.js",
      cwd: "/var/www/job_scheduler/current",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};