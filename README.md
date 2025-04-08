# Patch Semantic Filter

A simple web-based tool to filter out whitespace-only changes from git patch files, making code reviews more efficient by focusing on meaningful changes.

## Purpose

When reviewing pull requests, it's common to encounter changes that only modify whitespace (indentation, line endings, etc.) mixed with actual functional changes. This can make code reviews difficult and time-consuming.

This tool helps by:
- Parsing git patch files (.patch or .diff)
- Identifying changes that only affect whitespace
- Filtering out whitespace-only changes
- Providing statistics on the changes

## How to Use

1. Open `index.html` in any modern web browser
2. Copy the content of your `.patch` or `.diff` file
3. Paste it into the "Input Patch" textarea
4. Click "Filter Whitespace Changes"
5. Review the filtered patch and statistics

## Features

- Analyzes patch files to separate semantic changes from whitespace-only changes
- Provides statistics on files and hunks (chunks of changes)
- Shows a list of all changed files with their status
- Sorts files to prioritize those with semantic changes

## Implementation Details

The tool uses client-side JavaScript to parse and analyze patch files. It leverages the [diff](https://www.npmjs.com/package/diff) library from npm (loaded via unpkg) to help with comparing content.

## License

MIT
