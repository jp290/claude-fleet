# Grok Research Brief: iOS Pi Harness

Research the design of a minimal, high-performance **iOS-focused Pi agent harness** integrated into Claude Fleet.

## Context and constraints

- Fleet remains the sole control plane for tasks, workers, model routing, worktrees, verification, landing, and audits.
- Pi is the execution harness inside a Fleet session.
- The harness may expose tools, skills, environment profiles, and evidence capture, but must not create a competing task system or in-session agent hierarchy.
- Long-session input tokens and oversized tool results are already a major cost.
- Exact source reads, build logs, test results, screenshots, and verification tails must remain recoverable evidence.
- Do not assume that a Pi plugin is preferable to an MCP server, focused skill, existing Apple CLI, or small project-local script.

## Research scope

Determine which capabilities belong in:

- a shared iOS harness core;
- a project-local skill or script;
- an MCP server;
- a Pi extension;
- Fleet itself.

Investigate the complete iOS development feedback loop:

- inspect Swift, Objective-C, SwiftUI, UIKit, and Xcode project structure;
- use Swift and SourceKit-LSP diagnostics, symbols, references, and code actions;
- discover schemes, destinations, configurations, packages, and test plans;
- build and test through `xcodebuild` without hiding exact failures;
- boot, select, reset, and manage simulators through `simctl`;
- install, launch, terminate, and deep-link into applications;
- capture screenshots, video, accessibility state, device logs, crashes, and performance evidence;
- run XCTest, XCUITest, snapshot tests, previews, and focused smoke checks;
- inspect signing, entitlements, provisioning profiles, capabilities, and bundle configuration;
- distinguish simulator-only operations from device, signing, notarization, submission, and other external-effect boundaries;
- preserve a human owner taste gate for visual design, interaction quality, motion, copy, and product direction.

Examine how a harness configuration should select different:

- tool sets and skills;
- simulator and destination profiles;
- build, test, launch, and evidence commands;
- environment variables and secrets boundaries;
- agent/model profiles for implementation, debugging, visual review, accessibility, and performance analysis.

Model selection must remain bounded configuration or Fleet routing, not autonomous in-session orchestration.

For every relevant surface, classify support as `apply`, `unsupported`, or `not-applicable`. Explicitly identify Apple-host requirements, credential requirements, irreversible or externally visible actions, and capabilities that cannot be generalized safely.

Research current Pi extensions, MCP servers, Apple tooling, and CLI approaches using primary sources. Do not invent packages, adoption figures, compatibility, or benchmarks. Consider candidates such as LSP integration, a lazy MCP adapter, browser/web research, simulator automation, and Xcode-focused tooling without presuming that any candidate should be installed.

For every candidate:

1. Provide current primary-source links and maintenance or adoption evidence.
2. Classify it as compatible, redundant, authority-conflicting, unsafe, unsupported, or unnecessary compared with existing Apple tools or a small project-local script.
3. State whether it reduces actual model context, only changes UI rendering, or adds capability.
4. Identify privileges, network access, credentials, spawned processes, external effects, and output-volume risks.
5. Explain how exact build, test, signing, crash, and accessibility evidence remains recoverable.

## Required deliverables

1. A minimal iOS Pi harness architecture.
2. A capability matrix covering Swift navigation, Xcode builds, tests, simulators, runtime observation, accessibility, performance, signing, and release boundaries.
3. A proposed declarative harness configuration, including per-task agent/model profiles.
4. A ranked plugin/tool shortlist based on marginal benefit to this system.
5. Exactly one smallest reversible, project-local pilot.
6. Measurements, falsifying observations, security review, and rollback for that pilot.
7. Explicit unknowns and decisions that must remain owner-controlled.

Attack the premise that a large universal iOS harness or a bundle of popular plugins is desirable. Prefer the smallest mechanism that closes a real inspect-build-run-observe-verify loop while keeping credentials and external effects outside implicit agent authority.
