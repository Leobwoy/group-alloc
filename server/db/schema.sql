CREATE TABLE course_reps (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenants (
  id             SERIAL PRIMARY KEY,
  class_name     VARCHAR(255) NOT NULL,
  class_code     VARCHAR(20) UNIQUE NOT NULL,
  course_rep_id  INT NOT NULL REFERENCES course_reps(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_counters (
  tenant_id    INT PRIMARY KEY REFERENCES tenants(id),
  next_number  INT NOT NULL DEFAULT 1
);

CREATE TABLE groups (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES tenants(id),
  leader_name   VARCHAR(255) NOT NULL,
  group_name    VARCHAR(255) NOT NULL,
  group_number  INT NOT NULL,
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, group_number),
  UNIQUE (tenant_id, group_name)
);
