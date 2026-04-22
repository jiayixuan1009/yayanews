-- Migration: add audit_reason column to articles table
-- Run once before deploying agent7_auditor changes.
-- Safe to re-run (IF NOT EXISTS guard).

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS audit_reason TEXT;
