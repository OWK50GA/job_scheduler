module.exports = {
  apps: [
    {
      name: "job-scheduler-api",
      cwd: "/home/ubuntu/job_scheduler",
      script: "npm",
      args: "run start:server",
    },
    {
      name: "job-scheduler-worker",
      cwd: "/home/ubuntu/job_scheduler",
      script: "npm",
      args: "run start:worker",
    }
  ]
}