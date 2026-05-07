-- ============================================================
--  ImpulseCheck — MySQL Database Schema (Full Updated)
--  Run this file once to set up all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS impulsecheck;
USE impulsecheck;

-- ── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100)  NOT NULL,
  username      VARCHAR(50)   NOT NULL UNIQUE,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  phone_number  VARCHAR(20)   DEFAULT NULL,
  age           INT           DEFAULT NULL,
  date_of_birth DATE          DEFAULT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  avatar_url    TEXT          DEFAULT NULL,
  currency      VARCHAR(10)   DEFAULT 'PHP',
  is_verified   TINYINT(1)    DEFAULT 0,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── OTP VERIFICATIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_verifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT         NOT NULL,
  otp_code   VARCHAR(6)  NOT NULL,
  type       ENUM('register','forgot_password') DEFAULT 'register',
  expires_at DATETIME    NOT NULL,
  used       TINYINT(1)  DEFAULT 0,
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── BUDGETS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT                NOT NULL,
  amount     DECIMAL(12, 2)     NOT NULL,
  period     ENUM('monthly','weekly','biweekly') DEFAULT 'monthly',
  month      INT                NOT NULL,
  year       INT                NOT NULL,
  created_at TIMESTAMP          DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP          DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── BUDGET CATEGORIES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  budget_id     INT         NOT NULL,
  category_name VARCHAR(50) NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

-- ── PURCHASES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT                       NOT NULL,
  item_name     VARCHAR(150)              NOT NULL,
  price         DECIMAL(12, 2)            NOT NULL,
  category      VARCHAR(50)               DEFAULT 'Others',
  reason        VARCHAR(100)              DEFAULT NULL,
  emotion       VARCHAR(50)               DEFAULT NULL,
  ai_tag        ENUM('BUY','WAIT','AVOID') NOT NULL,
  ai_title      VARCHAR(100)              DEFAULT NULL,
  ai_subtitle   VARCHAR(255)              DEFAULT NULL,
  ai_reasons    JSON                      DEFAULT NULL,
  user_decision ENUM('BUY','WAIT','AVOID') NOT NULL,
  created_at    TIMESTAMP                 DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── NOTIFICATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  title      VARCHAR(100) NOT NULL,
  message    TEXT         NOT NULL,
  type       VARCHAR(50)  DEFAULT 'info',
  is_read    TINYINT(1)   DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── USER PREFERENCES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT         NOT NULL UNIQUE,
  currency          VARCHAR(10) DEFAULT 'PHP',
  default_emotion   VARCHAR(50) DEFAULT NULL,
  preselect_emotion TINYINT(1)  DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
