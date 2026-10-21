# Deploying Veritrace on AWS EC2

The whole app runs on one EC2 instance, with three containers: Caddy, the frontend and the backend. Caddy serves HTTPS with a free Let's Encrypt certificate for an [sslip.io](https://sslip.io) hostname, so no domain is needed. It sends `/api/*` to the backend and everything else to the frontend. The page and the API share one address, so there is no CORS to set up and the streamed answers go straight through.

```
browser ──HTTPS──> Caddy :443 ──/api/*──> backend :8000 (FastAPI, bge, DeBERTa) ──> Groq, backup Groq, Gemini
                              └──other──> frontend :3000 (Next.js)
```

The files are in `deploy/ec2/`: `docker-compose.yml`, `Caddyfile`, `setup.sh` and `update.sh`.

**How updates reach the server.** There are two ways, so the site follows `master` whether the instance is on or off:

- **When the instance starts**, it pulls the latest `master` and rebuilds what changed (`veritrace-update.service`). Until that finishes, the previous version keeps serving.
- **When you push to `master` while it is running**, GitHub Actions runs the tests and then tells the instance to update, through AWS Systems Manager (`.github/workflows/deploy.yml`). If the instance is stopped, the deploy is skipped and the boot update picks the change up next time.

If a pull or a build fails, the running version stays up. Whatever is on `master` goes live, so keep unfinished work on a branch.

## Before you start

- An AWS account with credits.
- The keys in your local `backend/.env`: `GROQ_API_KEY`, and optionally `GROQ_BACKUP_API_KEY` and `GEMINI_API_KEY`.

## 1. Set a budget alert

In the AWS console, open **Billing and Cost Management → Budgets → Create budget**. Choose **Use a template → Monthly cost budget** with an amount such as $20 and your email. AWS then emails you before the credits drain unnoticed.

## 2. Create a role for the instance

GitHub deploys reach the instance through AWS Systems Manager, which needs this role. Systems Manager also lets you open a terminal on the instance from the browser (EC2 → Connect → Session Manager), without SSH.

**IAM → Roles → Create role**:

1. Trusted entity: **AWS service**, use case **EC2**.
2. Permissions: **AmazonSSMManagedInstanceCore**.
3. Name it `veritrace-ec2`, then **Create role**.

## 3. Launch the instance

Open **EC2 → Launch instance**:

| Setting | Value | Why |
|---|---|---|
| Name | `veritrace` | |
| Image | **Ubuntu Server 24.04 LTS**, 64-bit (x86) | `setup.sh` expects Ubuntu |
| Instance type | **c7i-flex.large** (2 vCPU, 4 GB) | The backend peaks at about 1.5 GB. `t3.medium` also works; anything with 2 GB or less runs out of memory. |
| Key pair | Create one (`veritrace`, `.pem`), and keep the file | For SSH |
| Network: security group | Allow SSH, HTTP and HTTPS from **Anywhere** | Ports 80 and 443 are public; port 80 also lets Let's Encrypt check the hostname. SSH is open so it works from any network; Ubuntu on EC2 accepts only your key, never a password. Choose **My IP** for SSH instead if you always work from one place. |
| Storage | **30 GB gp3** | The images take about 5 GB, and rebuilds need room |
| Advanced details → IAM instance profile | **veritrace-ec2** | For deploys from GitHub (step 2) |

Then **Launch instance**.

## 4. Give it a fixed address

The default public IP changes every time the instance stops. The sslip.io hostname is built from the IP, so the address has to stay the same.

**EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**, then **Actions → Associate Elastic IP address**, and choose the `veritrace` instance. Note the IP, for example `3.12.34.56`. The app will be at `https://3-12-34-56.sslip.io`.

## 5. Put the code and the keys on the server

From your laptop, in the repository root:

```bash
chmod 400 ~/Downloads/veritrace.pem
ssh -i ~/Downloads/veritrace.pem ubuntu@3.12.34.56 'git clone https://github.com/DE9856/Veritrace.git'
scp -i ~/Downloads/veritrace.pem backend/.env ubuntu@3.12.34.56:Veritrace/backend/.env
```

The keys go over SSH only. They never enter git or the Docker images: `.env` is gitignored and listed in `.dockerignore`, and Compose passes it to the backend container at run time.

## 6. Start it

```bash
ssh -i ~/Downloads/veritrace.pem ubuntu@3.12.34.56
cd Veritrace
deploy/ec2/setup.sh
```

The script does the following:

- installs Docker
- adds 2 GB of swap
- installs the update-at-boot service
- works out the hostname from the instance's public IP
- builds the images and starts everything

The first build takes about 15 minutes. It installs PyTorch, downloads the embedding and NLI models, and builds the frontend.

Open the URL it prints. The backend takes about a minute to load its models, and Caddy gets the certificate on the first visit. Until then the page may show an error, so reload after a minute. The header dot should turn green and name the model. The two sample documents are indexed on the first start.

Check from the server:

```bash
curl -s https://3-12-34-56.sslip.io/api/health   # "status": "ok"
cd deploy/ec2 && docker compose ps               # three containers, backend "healthy"
```

## 7. Deploys from GitHub

This step is optional; without it, the instance still updates itself at every start. It lets GitHub sign in to AWS with a short-lived token (OpenID Connect), so no AWS keys are stored in GitHub and no SSH port has to be open to the internet.

1. **IAM → Identity providers → Add provider**: choose **OpenID Connect**, with provider URL `https://token.actions.githubusercontent.com` and audience `sts.amazonaws.com`.
2. **IAM → Roles → Create role**: choose **Web identity**, the provider from step 1 and audience `sts.amazonaws.com`. Set GitHub organization `DE9856`, repository `Veritrace` and branch `master`. Skip the permissions page, name the role `veritrace-github-deploy`, and create it.
3. Open the new role, then **Add permissions → Create inline policy → JSON**. Paste the following, with your region, account ID (top right of the console) and instance ID (EC2 → Instances) filled in:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "ec2:DescribeInstances", "Resource": "*" },
       {
         "Effect": "Allow",
         "Action": "ssm:SendCommand",
         "Resource": [
           "arn:aws:ec2:REGION:ACCOUNT_ID:instance/INSTANCE_ID",
           "arn:aws:ssm:REGION::document/AWS-RunShellScript"
         ]
       },
       { "Effect": "Allow", "Action": "ssm:GetCommandInvocation", "Resource": "*" }
     ]
   }
   ```

   The role can check the instance's state and run the update command, and nothing else.
4. In GitHub, open the repository's **Settings → Secrets and variables → Actions → Variables**, and add three repository variables:

   | Name | Value |
   |---|---|
   | `EC2_INSTANCE_ID` | for example `i-0abc123def4567890` |
   | `AWS_REGION` | for example `ap-south-1` |
   | `AWS_DEPLOY_ROLE_ARN` | the ARN of `veritrace-github-deploy` (shown on the role's page) |

From now on, each push to `master` runs the backend tests and the frontend checks. If they pass and the instance is running, it updates. The run is in the repository's **Actions** tab, with the update's output. Until `EC2_INSTANCE_ID` is set, the deploy job is skipped and only the checks run. To deploy without pushing, choose **Actions → Test and deploy → Run workflow**.

## Updating by hand

Pushing to `master` (with the instance running) or starting the instance is normally enough. To update by hand, open a terminal on the instance (SSH, or Session Manager):

```bash
cd Veritrace && deploy/ec2/update.sh           # pull master and rebuild what changed
deploy/ec2/update.sh --force                   # rebuild even if nothing new was pulled
```

Only the parts that changed are rebuilt. The boot update's log is in `journalctl -u veritrace-update`. To change a key or a setting, edit `backend/.env` on the server, or copy it again with `scp`. Then run `cd deploy/ec2 && docker compose up -d`.

## Saving credits

- **Stop the instance** (EC2 → Instance state → Stop) when nobody needs the app. A stopped instance costs nothing for compute. The disk (about $2.40 a month for 30 GB) and the Elastic IP (about $3.60 a month) are still charged.
- **Start it again** later, and everything comes back on its own (`restart: unless-stopped`), then updates to the latest `master`. The documents, the vector store and the certificate are kept in Docker volumes on the disk.
- **Terminating** the instance deletes the disk and everything on it. If you terminate it, release the Elastic IP too, or AWS keeps charging for it.

## Things to know

- **The app is public.** Anyone with the URL can ask questions, which spends the Groq quota on your key and the backup key, then Gemini's. The free tiers cost nothing, but once a quota is spent, questions slow down and then fail until it recovers.
- **All visitors share one Groq per-minute limit** of 8,000 tokens, and one question uses a few thousand. Two people asking at once wait for each other; the app waits for the limit instead of failing.
- **Uploaded documents survive restarts and rebuilds.** They are kept in the `backend-data` volume. To start from an empty library, run `docker compose down -v` (this also deletes the certificate) and run `setup.sh` again.

## Problems

| Problem | Fix |
|---|---|
| The browser says the connection is not private, or the page will not load over HTTPS | Caddy has not got a certificate yet. Check `docker compose logs caddy`. If Let's Encrypt refused the sslip.io name (it limits certificates per domain, and many people use sslip.io), get a free name at [duckdns.org](https://www.duckdns.org) pointed at the Elastic IP, then run `deploy/ec2/setup.sh yourname.duckdns.org`. |
| `setup.sh: backend/.env is missing` | Do the `scp` in step 5. |
| `permission denied` from Docker | The script falls back to `sudo` on the first run. Log out and back in, and `docker` works without it. |
| Header dot is amber | A key is wrong or a quota is spent. Hover over the dot for the reason, and check `docker compose logs backend`. |
| The backend restarts over and over | Usually out of memory. `docker compose logs backend` and `free -h` show it. Use an instance with 4 GB or more. |
| SSH times out | If the SSH rule is set to My IP, your IP changed: edit the rule, or use Session Manager. |
| The deploy job fails with "Not authorized to perform sts:AssumeRoleWithWebIdentity" | The role's trust policy must name `DE9856/Veritrace` and branch `master` (step 7.2), and the `AWS_DEPLOY_ROLE_ARN` variable must be that role's ARN. |
| The deploy job fails with `InvalidInstanceId` | The instance has no `veritrace-ec2` role, or its SSM agent has not registered yet. Attach the role (EC2 → Actions → Security → Modify IAM role), then wait a few minutes. |
| The site did not change after starting the instance | The boot update may still be building. Check `journalctl -u veritrace-update -f`. |
