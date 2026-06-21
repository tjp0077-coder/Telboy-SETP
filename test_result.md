#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Project: EDI SETP 2026 — Symposium Hub (imported from GitHub: Telboy-SETP)
user_problem_statement: |
  Mobile companion app for SETP Test Pilot Symposium Edinburgh (Jul 2026).
  Goal: deliver to delegates via a SINGLE QR CODE and push design updates
  seamlessly while deployed → deploy as installable PWA (web).

## Work done (main agent):
##  - Imported Telboy-SETP repo, installed deps, services running (backend+expo+mongo).
##  - Fixed Expo Metro crash: forced ws@8 via package.json "resolutions" (repo had ws@7).
##  - PWA already configured (manifest, sw.js, icons, +html.tsx). Verified all assets serve 200.
##  - Improved service worker (v2): HTML navigation now NETWORK-FIRST so design updates
##    appear immediately after redeploy; immutable hashed assets stay cache-first; API network-first.
##  - Verified Home + Schedule render correctly. Backend APIs returning 200.
## Note: bcrypt version-read warning in backend logs is non-fatal (login returns 200).
## Next: user deploys via Emergent Deploy button → public URL → generate QR for delegates.

## BUG FIX (Vercel admin login "Invalid username or password" / 500):
## RCA: Frontend (Vercel, telboy-setp.vercel.app) -> backend (Render, telboy-setp.onrender.com).
##   Render DB had misseeded admins: dave.mackay wrong/absent pw (401); terry.parker doc
##   missing password_hash -> login endpoint did admin["password_hash"] -> 500 crash.
##   seed_admins() was insert-only so bad records never self-repaired.
## FIXES (backend/server.py):
##   1. seed_admins() now UPSERTs and syncs password_hash+name from env on every startup (self-healing).
##   2. login() uses admin.get("password_hash") -> returns 401 instead of 500 on corrupt docs.
##   3. frontend src/AuthContext.tsx surfaces real errors (network vs credentials vs server).
## Admin creds: stored in MongoDB admins collection, seeded from ADMIN1/2/3_* env vars.
## Verified locally: normal login 200; corrupt admin 401 (no 500); corrupted hash repaired after restart.
## test_priority: backend auth flow (login, seed, /auth/me, admin CRUD).
