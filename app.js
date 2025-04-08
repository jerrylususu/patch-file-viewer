document.addEventListener('DOMContentLoaded', () => {
    const inputPatch = document.getElementById('inputPatch');
    const outputPatch = document.getElementById('outputPatch');
    const filterButton = document.getElementById('filterButton');
    const statsElement = document.getElementById('stats');
    const fileListElement = document.getElementById('fileList');
    const loadingElement = document.getElementById('loading');

    // Use the Diff library from unpkg
    const JsDiff = window.Diff;

    filterButton.addEventListener('click', () => {
        const patchContent = inputPatch.value.trim();
        if (!patchContent) {
            alert('Please paste a patch file first!');
            return;
        }

        // Show loading indicator
        loadingElement.style.display = 'block';
        
        // Use setTimeout to allow the UI to update before processing
        setTimeout(() => {
            try {
                const result = filterWhitespaceChanges(patchContent);
                outputPatch.value = result.filteredPatch;
                updateStats(result.stats);
                updateFileList(result.fileChanges);
            } catch (error) {
                console.error('Error processing patch:', error);
                alert('Error processing patch: ' + error.message);
            } finally {
                // Hide loading indicator
                loadingElement.style.display = 'none';
            }
        }, 50);
    });

    function filterWhitespaceChanges(patchContent) {
        // Split the patch into files
        const filePatches = splitPatchIntoFiles(patchContent);
        
        let filteredPatch = '';
        let totalFiles = 0;
        let semanticFiles = 0;
        let whitespaceOnlyFiles = 0;
        let totalHunks = 0;
        let semanticHunks = 0;
        let whitespaceOnlyHunks = 0;
        
        const fileChanges = [];

        // Process each file patch
        filePatches.forEach(filePatch => {
            totalFiles++;
            
            // Extract file headers and hunks
            const { header, hunks } = parseFilePatch(filePatch);
            const fileName = extractFileName(header);
            
            let fileHasSemanticChanges = false;
            let filteredHunks = [];
            let fileHunkStats = { total: 0, semantic: 0, whitespace: 0 };
            
            // Process each hunk in the file
            hunks.forEach(hunk => {
                totalHunks++;
                fileHunkStats.total++;
                
                // Check if the hunk only contains whitespace changes
                const isWhitespaceOnly = isHunkWhitespaceOnly(hunk);
                
                if (!isWhitespaceOnly) {
                    // This hunk has semantic changes
                    semanticHunks++;
                    fileHunkStats.semantic++;
                    fileHasSemanticChanges = true;
                    filteredHunks.push(hunk);
                } else {
                    // This hunk only has whitespace changes
                    whitespaceOnlyHunks++;
                    fileHunkStats.whitespace++;
                }
            });
            
            // Update file statistics
            if (fileHasSemanticChanges) {
                semanticFiles++;
                // Add this file with its semantic hunks to the filtered patch
                if (filteredHunks.length > 0) {
                    filteredPatch += header + '\n' + filteredHunks.join('\n') + '\n';
                }
            } else {
                whitespaceOnlyFiles++;
            }
            
            // Add to file changes list
            fileChanges.push({
                name: fileName,
                hasSemanticChanges: fileHasSemanticChanges,
                stats: fileHunkStats
            });
        });
        
        return {
            filteredPatch,
            stats: {
                totalFiles,
                semanticFiles,
                whitespaceOnlyFiles,
                totalHunks,
                semanticHunks,
                whitespaceOnlyHunks
            },
            fileChanges
        };
    }

    function splitPatchIntoFiles(patchContent) {
        // Split the patch by 'diff --git' which indicates the start of a new file diff
        const fileParts = patchContent.split(/(?=diff --git )/);
        
        // Filter out any empty parts
        return fileParts.filter(part => part.trim().startsWith('diff --git'));
    }

    function parseFilePatch(filePatch) {
        // Find where the hunks start (they start with @@)
        const hunkStartIndex = filePatch.indexOf('@@');
        
        if (hunkStartIndex === -1) {
            return { header: filePatch, hunks: [] };
        }
        
        // Extract the header (everything before the first hunk)
        const header = filePatch.substring(0, hunkStartIndex).trim();
        
        // Extract all hunks
        const hunksContent = filePatch.substring(hunkStartIndex);
        const hunks = hunksContent.split(/(?=@@\s-)/g);
        
        return { header, hunks };
    }

    function extractFileName(header) {
        // Extract the file name from the header
        // The format is typically: diff --git a/path/to/file b/path/to/file
        const match = header.match(/diff --git a\/(.*?) b\//);  
        return match ? match[1] : 'Unknown file';
    }

    function isHunkWhitespaceOnly(hunk) {
        // Parse the hunk header to get line information
        const headerMatch = hunk.match(/@@\s-(\d+),?(\d*)\s\+(\d+),?(\d*)\s@@/);
        if (!headerMatch) return false;
        
        // Extract the content lines (excluding the @@ line)
        const lines = hunk.split('\n').slice(1).filter(line => line.trim() !== '');
        
        // Group lines by added and removed
        const addedLines = [];
        const removedLines = [];
        
        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('++')) {
                addedLines.push(line.substring(1));
            } else if (line.startsWith('-') && !line.startsWith('--')) {
                removedLines.push(line.substring(1));
            }
        }
        
        // If there are no added or removed lines, it's not a whitespace change
        if (addedLines.length === 0 && removedLines.length === 0) {
            return false;
        }
        
        // For multi-line reformatting, we need to join the lines and compare
        // Join all added lines and all removed lines
        const joinedAdded = addedLines.join('\n');
        const joinedRemoved = removedLines.join('\n');
        
        // Compare the joined content ignoring whitespace
        const normalizedAdded = normalizeWhitespace(joinedAdded);
        const normalizedRemoved = normalizeWhitespace(joinedRemoved);
        
        // If the normalized content matches, it's a whitespace-only change
        if (normalizedAdded === normalizedRemoved) {
            return true;
        }
        
        // If the joined content doesn't match, try to match individual lines
        // This handles cases where lines are reordered but content is the same
        if (addedLines.length === removedLines.length) {
            const matchedRemoved = new Set();
            
            for (const addedLine of addedLines) {
                let foundMatch = false;
                
                for (let i = 0; i < removedLines.length; i++) {
                    if (matchedRemoved.has(i)) continue;
                    
                    const removedLine = removedLines[i];
                    
                    // Compare the lines ignoring whitespace
                    const normalizedAddedLine = normalizeWhitespace(addedLine);
                    const normalizedRemovedLine = normalizeWhitespace(removedLine);
                    
                    if (normalizedAddedLine === normalizedRemovedLine) {
                        // This is a whitespace-only change
                        matchedRemoved.add(i);
                        foundMatch = true;
                        break;
                    }
                }
                
                if (!foundMatch) {
                    // If we couldn't find a match for this added line, it's a semantic change
                    return false;
                }
            }
            
            // If all lines matched, it's a whitespace-only change
            return true;
        }
        
        // If we get here, it's a semantic change
        return false;
    }

    function normalizeWhitespace(str) {
        // Remove all whitespace for comparison
        return str.replace(/\s+/g, '');
    }

    function updateStats(stats) {
        // Handle division by zero
        const fileSemanticPercent = stats.totalFiles > 0 ? Math.round(stats.semanticFiles / stats.totalFiles * 100) : 0;
        const fileWhitespacePercent = stats.totalFiles > 0 ? Math.round(stats.whitespaceOnlyFiles / stats.totalFiles * 100) : 0;
        const hunkSemanticPercent = stats.totalHunks > 0 ? Math.round(stats.semanticHunks / stats.totalHunks * 100) : 0;
        const hunkWhitespacePercent = stats.totalHunks > 0 ? Math.round(stats.whitespaceOnlyHunks / stats.totalHunks * 100) : 0;
        
        statsElement.innerHTML = `
            <h3>Statistics</h3>
            <p><strong>Files:</strong> ${stats.totalFiles} total, 
               ${stats.semanticFiles} with semantic changes (${fileSemanticPercent}%), 
               ${stats.whitespaceOnlyFiles} whitespace-only (${fileWhitespacePercent}%)</p>
            <p><strong>Hunks:</strong> ${stats.totalHunks} total, 
               ${stats.semanticHunks} with semantic changes (${hunkSemanticPercent}%), 
               ${stats.whitespaceOnlyHunks} whitespace-only (${hunkWhitespacePercent}%)</p>
        `;
    }

    function updateFileList(fileChanges) {
        let html = '<h3>Files Changed</h3>';
        
        if (fileChanges.length === 0) {
            html += '<p>No files analyzed.</p>';
        } else {
            // Sort files by semantic changes first, then by name
            fileChanges.sort((a, b) => {
                if (a.hasSemanticChanges !== b.hasSemanticChanges) {
                    return b.hasSemanticChanges ? 1 : -1; // Semantic changes first
                }
                return a.name.localeCompare(b.name);
            });
            
            html += '<div>';
            fileChanges.forEach(file => {
                const statusClass = file.hasSemanticChanges ? 'status-semantic' : 'status-whitespace';
                const statusText = file.hasSemanticChanges ? 'Semantic Changes' : 'Whitespace Only';
                
                html += `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <div>
                            <span>Hunks: ${file.stats.total} total, ${file.stats.semantic} semantic, ${file.stats.whitespace} whitespace</span>
                            <span class="file-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        fileListElement.innerHTML = html;
    }
});
