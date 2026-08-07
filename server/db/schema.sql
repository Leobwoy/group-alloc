CREATE TABLE IF NOT EXISTS course_reps (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id             SERIAL PRIMARY KEY,
  class_name     VARCHAR(255) NOT NULL,
  class_code     VARCHAR(20) UNIQUE NOT NULL,
  course_rep_id  INT NOT NULL REFERENCES course_reps(id),
  is_locked      BOOLEAN DEFAULT FALSE,
  max_groups     INT DEFAULT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_counters (
  tenant_id    INT PRIMARY KEY REFERENCES tenants(id),
  next_number  INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS groups (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id),
  leader_name   VARCHAR(255) NOT NULL,
  group_name    VARCHAR(255) NOT NULL,
  group_number  INT NOT NULL,
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, group_number),
  UNIQUE (tenant_id, group_name)
);
