#!/usr/bin/env python3
"""Distill MCP Server — Extract knowledge from Claude Code conversations."""

import asyncio

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .tools.recall import handle_recall
from .tools.learn import handle_learn
from .tools.profile import handle_profile
from .tools.digest import handle_digest
from .tools.memory import handle_memory

server = Server("distill")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="recall",
            description="Search accumulated knowledge by semantic similarity",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for knowledge retrieval",
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["global", "project"],
                        "description": "Filter by scope (default: both)",
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "pattern",
                            "preference",
                            "decision",
                            "mistake",
                            "workaround",
                        ],
                        "description": "Filter by knowledge type",
                    },
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 20,
                        "description": "Max results (default: 5)",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="learn",
            description="Extract and save knowledge from a conversation transcript",
            inputSchema={
                "type": "object",
                "properties": {
                    "transcript_path": {
                        "type": "string",
                        "description": "Path to the .jsonl transcript file",
                    },
                    "session_id": {
                        "type": "string",
                        "description": "Session ID for tracking source",
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["global", "project"],
                        "description": "Force scope (default: auto-detect per chunk)",
                    },
                },
                "required": ["transcript_path", "session_id"],
            },
        ),
        Tool(
            name="profile",
            description="View accumulated user knowledge profile and statistics",
            inputSchema={
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["global", "project"],
                        "description": "Filter by scope (default: both)",
                    },
                },
            },
        ),
        Tool(
            name="digest",
            description="Analyze patterns across accumulated knowledge: merge duplicates, update confidence scores",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="memory",
            description="Manage knowledge: promote/demote scope, or delete entries",
            inputSchema={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["promote", "demote", "delete"],
                        "description": "promote: project->global, demote: global->project, delete: remove",
                    },
                    "id": {
                        "type": "string",
                        "description": "Knowledge entry ID",
                    },
                },
                "required": ["action", "id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "recall":
        result = await handle_recall(
            query=arguments["query"],
            scope=arguments.get("scope"),
            type_=arguments.get("type"),
            limit=arguments.get("limit"),
        )
    elif name == "learn":
        result = await handle_learn(
            transcript_path=arguments["transcript_path"],
            session_id=arguments["session_id"],
            scope=arguments.get("scope"),
        )
    elif name == "profile":
        result = await handle_profile(
            scope=arguments.get("scope"),
        )
    elif name == "digest":
        result = await handle_digest()
    elif name == "memory":
        result = await handle_memory(
            action=arguments["action"],
            chunk_id=arguments["id"],
        )
    else:
        result = f"Unknown tool: {name}"

    return [TextContent(type="text", text=result)]


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
