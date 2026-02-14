"""
Markdown + LaTeX Viewer with Editor
- Split-pane view: editor on left, rendered view on right
- Intelligent LaTeX detection and rendering
- Hover to toggle KaTeX rendering on text segments
- Uses CodeMirror for editing, marked.js for markdown, KaTeX for LaTeX

Usage:
    pip install flask
    python viewer.py
    Open in browser: http://127.0.0.1:5001/
"""
from flask import Flask, request, render_template_string, jsonify
import os

app = Flask(__name__)

HTML = r"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Markdown + LaTeX Viewer</title>
  
  <!-- CodeMirror -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css">
  
  <!-- KaTeX -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      margin: 0; 
      padding: 0;
      overflow: hidden;
    }
    
    header { 
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      gap: 12px;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    header h1 { 
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    
    .toolbar { 
      margin-left: auto;
      display: flex;
      gap: 8px;
    }
    
    button {
      padding: 8px 16px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    button:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-1px);
    }
    
    #container {
      display: flex;
      height: calc(100vh - 56px);
    }
    
    #editor-pane {
      width: 50%;
      border-right: 2px solid #ddd;
      display: flex;
      flex-direction: column;
    }
    
    #viewer-pane {
      width: 50%;
      overflow-y: auto;
      padding: 20px 40px;
      background: #fafafa;
      position: relative;
    }
    
    .CodeMirror {
      height: 100%;
      font-size: 14px;
      line-height: 1.6;
    }
    
    /* Rendered content styling */
    #rendered-content {
      max-width: 900px;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      line-height: 1.8;
    }
    
    #rendered-content h1, 
    #rendered-content h2, 
    #rendered-content h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #333;
    }
    
    #rendered-content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    
    #rendered-content pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      border-left: 4px solid #667eea;
    }
    
    /* KaTeX rendered segments */
    .katex-display {
      margin: 1em 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    
    /* Manual KaTeX renders have hover effect */
    .manual-katex-render {
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .manual-katex-render:hover {
      background: rgba(102, 126, 234, 0.15) !important;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }
    
    /* Selection context menu */
    #context-menu {
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 4px;
      z-index: 10000;
      display: none;
      min-width: 150px;
    }
    
    #context-menu button {
      display: block;
      width: 100%;
      padding: 8px 16px;
      background: white;
      color: #333;
      border: none;
      border-radius: 4px;
      text-align: left;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
      margin: 2px 0;
    }
    
    #context-menu button:first-child {
      margin-top: 0;
    }
    
    #context-menu button:last-child {
      margin-bottom: 0;
    }
    
    #context-menu button:hover {
      background: #667eea;
      color: white;
      transform: none;
    }
    
    ::selection {
      background: rgba(102, 126, 234, 0.3);
    }
    
    .status-bar {
      position: fixed;
      bottom: 12px;
      right: 12px;
      padding: 8px 16px;
      background: rgba(0,0,0,0.8);
      color: white;
      font-size: 12px;
      border-radius: 6px;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    
    .status-bar.show {
      opacity: 1;
    }
    
    /* Resizer */
    #resizer {
      width: 4px;
      background: #ddd;
      cursor: col-resize;
      position: relative;
      z-index: 10;
    }
    
    #resizer:hover {
      background: #667eea;
    }
  </style>
</head>
<body>
  <header>
    <h1>📝 Markdown + LaTeX Viewer</h1>
    <div class="toolbar">
      <button id="refresh">Refresh</button>
      <button id="save">Save</button>
    </div>
  </header>
  
  <div id="container">
    <div id="editor-pane">
      <textarea id="code"></textarea>
    </div>
    <div id="resizer"></div>
    <div id="viewer-pane">
      <div id="rendered-content"></div>
    </div>
  </div>
  
  <div id="context-menu">
    <button id="render-katex">✨ Render as KaTeX</button>
    <button id="remove-katex">🗑️ Remove KaTeX rendering</button>
  </div>
  
  <div id="status-bar" class="status-bar"></div>
  
  <!-- Libraries -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/markdown/markdown.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  
  <script>
    // Initialize CodeMirror
    const textarea = document.getElementById('code');
    const editor = CodeMirror.fromTextArea(textarea, {
      mode: 'markdown',
      lineNumbers: true,
      lineWrapping: true,
      theme: 'default',
      indentUnit: 2,
      tabSize: 2,
      extraKeys: {
        'Cmd-S': () => saveFile(),
        'Ctrl-S': () => saveFile(),
        Tab: function(cm) {
          if (cm.somethingSelected()) cm.indentSelection("add");
          else cm.replaceSelection("  ");
        }
      }
    });
    
    // Configure marked to not escape backslashes in math
    marked.setOptions({
      breaks: false,
      gfm: true,
      pedantic: false
    });
    
    // Render content with standard markdown + KaTeX
    function renderContent() {
      const content = editor.getValue();
      const renderedDiv = document.getElementById('rendered-content');
      
      // Pre-process: protect LaTeX delimiters from markdown parser
      let processedContent = content;
      
      // Temporarily replace LaTeX blocks to protect them
      const mathBlocks = [];
      let mathIndex = 0;
      
      // Protect display math \[...\]
      processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
        const placeholder = `MATHBLOCK${mathIndex}DISPLAY`;
        mathBlocks[mathIndex] = { type: 'display', latex: latex, placeholder };
        mathIndex++;
        return placeholder;
      });
      
      // Protect display math $$...$$
      processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
        const placeholder = `MATHBLOCK${mathIndex}DISPLAY`;
        mathBlocks[mathIndex] = { type: 'display', latex: latex, placeholder };
        mathIndex++;
        return placeholder;
      });
      
      // Protect inline math \(...\)
      processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
        const placeholder = `MATHBLOCK${mathIndex}INLINE`;
        mathBlocks[mathIndex] = { type: 'inline', latex: latex, placeholder };
        mathIndex++;
        return placeholder;
      });
      
      // Protect inline math $...$
      processedContent = processedContent.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
        const placeholder = `MATHBLOCK${mathIndex}INLINE`;
        mathBlocks[mathIndex] = { type: 'inline', latex: latex, placeholder };
        mathIndex++;
        return placeholder;
      });
      
      // Convert markdown to HTML
      let htmlContent = marked.parse(processedContent);
      
      // Restore and render LaTeX blocks
      mathBlocks.forEach((block, index) => {
        if (block) {
          try {
            const rendered = katex.renderToString(block.latex, {
              displayMode: block.type === 'display',
              throwOnError: false,
              errorColor: '#cc0000',
              strict: false,
              trust: false,
              macros: {
                "\\RR": "\\mathbb{R}",
                "\\NN": "\\mathbb{N}",
                "\\ZZ": "\\mathbb{Z}",
                "\\QQ": "\\mathbb{Q}",
              }
            });
            htmlContent = htmlContent.replace(block.placeholder, rendered);
          } catch (e) {
            console.error('KaTeX error:', e);
            htmlContent = htmlContent.replace(block.placeholder, block.latex);
          }
        }
      });
      
      renderedDiv.innerHTML = htmlContent;
      showStatus('Content rendered');
    }
    
    // Context menu for selection
    const contextMenu = document.getElementById('context-menu');
    const renderButton = document.getElementById('render-katex');
    const removeButton = document.getElementById('remove-katex');
    const viewerPane = document.getElementById('viewer-pane');
    const renderedContent = document.getElementById('rendered-content');
    let selectedText = '';
    let selectionRange = null;
    let selectedElement = null;
    
    // Ensure both buttons are visible by default
    renderButton.style.display = 'block';
    removeButton.style.display = 'block';
    
    console.log('Context menu element:', contextMenu);
    console.log('Viewer pane element:', viewerPane);
    
    // Show context menu on text selection in viewer
    document.addEventListener('mouseup', (e) => {
      // Only handle selections within the viewer pane
      if (!viewerPane.contains(e.target)) {
        return;
      }
      
      const selection = window.getSelection();
      selectedText = selection.toString().trim();
      
      console.log('Selection detected:', selectedText);
      
      if (selectedText.length > 0) {
        selectionRange = selection.getRangeAt(0);
        selectedElement = selection.anchorNode.parentElement;
        
        // Always show both buttons
        renderButton.style.display = 'block';
        removeButton.style.display = 'block';
        
        // Position context menu near cursor
        const x = e.clientX;
        const y = e.clientY + 10;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
        
        console.log('Context menu shown at:', x, y);
        
        // Prevent default context menu
        e.preventDefault();
      } else {
        contextMenu.style.display = 'none';
      }
    });
    
    // Hide context menu on click outside
    document.addEventListener('mousedown', (e) => {
      if (!contextMenu.contains(e.target)) {
        contextMenu.style.display = 'none';
      }
    });
    
    // Render selected text as KaTeX
    document.getElementById('render-katex').addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event from bubbling
      if (!selectedText || !selectionRange) return;
      
      try {
        // Create a span to hold the rendered KaTeX
        const katexSpan = document.createElement('span');
        katexSpan.style.display = 'inline-block';
        katexSpan.style.padding = '2px 4px';
        katexSpan.style.margin = '0 2px';
        katexSpan.style.background = 'rgba(102, 126, 234, 0.05)';
        katexSpan.style.borderRadius = '3px';
        katexSpan.setAttribute('data-original-latex', selectedText);
        katexSpan.classList.add('manual-katex-render');
        
        // Try to render as KaTeX
        katex.render(selectedText, katexSpan, {
          displayMode: false,
          throwOnError: true,
          errorColor: '#cc0000',
          strict: false,
          trust: false,
        });
        
        // Replace the selection with rendered KaTeX
        selectionRange.deleteContents();
        selectionRange.insertNode(katexSpan);
        
        showStatus('✓ Rendered as KaTeX', 2000);
      } catch (e) {
        // If it fails, try display mode
        try {
          const katexDiv = document.createElement('div');
          katexDiv.style.margin = '1em 0';
          katexDiv.style.padding = '8px';
          katexDiv.style.background = 'rgba(102, 126, 234, 0.05)';
          katexDiv.style.borderRadius = '6px';
          katexDiv.setAttribute('data-original-latex', selectedText);
          katexDiv.classList.add('manual-katex-render');
          
          katex.render(selectedText, katexDiv, {
            displayMode: true,
            throwOnError: true,
            errorColor: '#cc0000',
            strict: false,
            trust: false,
          });
          
          selectionRange.deleteContents();
          selectionRange.insertNode(katexDiv);
          
          showStatus('✓ Rendered as KaTeX (display mode)', 2000);
        } catch (e) {
          console.error('KaTeX rendering error:', e);
          showStatus('✗ Invalid LaTeX syntax', 3000);
        }
      }
      
      contextMenu.style.display = 'none';
      window.getSelection().removeAllRanges();
    });
    
    // Remove KaTeX rendering from selected element
    document.getElementById('remove-katex').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!selectedElement) return;
      
      try {
        // Find the manual KaTeX container element
        let katexContainer = selectedElement.closest('.manual-katex-render');
        
        if (!katexContainer) {
          // Check if the selected element is the container
          if (selectedElement.classList?.contains('manual-katex-render')) {
            katexContainer = selectedElement;
          } else {
            // Look for any wrapper with the background style
            katexContainer = selectedElement.closest('span[style*="rgba(102, 126, 234"]') ||
                           selectedElement.closest('div[style*="rgba(102, 126, 234"]');
          }
        }
        
        if (katexContainer && katexContainer.parentNode) {
          // Get the original LaTeX or text content
          const originalLatex = katexContainer.getAttribute('data-original-latex');
          const textContent = originalLatex || katexContainer.textContent || selectedText;
          const textNode = document.createTextNode(textContent);
          katexContainer.parentNode.replaceChild(textNode, katexContainer);
          showStatus('✓ KaTeX rendering removed', 2000);
        } else {
          showStatus('✗ No manually rendered KaTeX found', 2000);
        }
      } catch (e) {
        console.error('Error removing KaTeX:', e);
        showStatus('✗ Error removing rendering', 3000);
      }
      
      contextMenu.style.display = 'none';
      window.getSelection().removeAllRanges();
    });
    
    // Auto-refresh on edit (debounced)
    let refreshTimeout;
    editor.on('change', () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(renderContent, 500);
    });
    
    // Save file
    async function saveFile() {
      const content = editor.getValue();
      try {
        const resp = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        
        if (resp.ok) {
          showStatus('✓ Saved successfully', 3000);
        } else {
          showStatus('✗ Save failed', 3000);
        }
      } catch (e) {
        console.error('Save error:', e);
        showStatus('✗ Save error', 3000);
      }
    }
    
    // Load initial content
    async function loadFile() {
      try {
        const resp = await fetch('/load');
        if (resp.ok) {
          const data = await resp.text();
          editor.setValue(data);
          renderContent();
        }
      } catch (e) {
        console.error('Load error:', e);
      }
    }
    
    // Show status message
    function showStatus(message, duration = 2000) {
      const statusBar = document.getElementById('status-bar');
      statusBar.textContent = message;
      statusBar.classList.add('show');
      setTimeout(() => {
        statusBar.classList.remove('show');
      }, duration);
    }
    
    // Event listeners
    document.getElementById('refresh').addEventListener('click', renderContent);
    document.getElementById('save').addEventListener('click', saveFile);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    });
    
    // Resizer functionality
    const resizer = document.getElementById('resizer');
    const editorPane = document.getElementById('editor-pane');
    const container = document.getElementById('container');
    
    let isResizing = false;
    
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      if (newWidth > 20 && newWidth < 80) {
        editorPane.style.width = `${newWidth}%`;
        document.getElementById('viewer-pane').style.width = `${100 - newWidth}%`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    });
    
    // Initialize
    loadFile();
  </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/load')
def load_file():
    """Load the document.md file"""
    filepath = os.path.join(os.path.dirname(__file__), 'document.md')
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return str(e), 500

@app.route('/save', methods=['POST'])
def save_file():
    """Save content to document.md"""
    filepath = os.path.join(os.path.dirname(__file__), 'document.md')
    try:
        data = request.get_json()
        content = data.get('content', '')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Markdown + LaTeX Viewer")
    print("="*60)
    print("\n📂 Viewing: document.md")
    print("🌐 Open: http://127.0.0.1:4949/")
    print("\n✨ Features:")
    print("  • Split-pane editor and live preview")
    print("  • Standard markdown + KaTeX rendering")
    print("  • Select text in viewer → click 'Render as KaTeX'")
    print("  • Auto-renders LaTeX in $ $, $$ $$, \\( \\), \\[ \\]")
    print("  • Resizable panes (drag the divider)")
    print("\n⌨️  Shortcuts:")
    print("  • Cmd/Ctrl + S: Save file")
    print("  • Auto-refresh on edit (500ms delay)")
    print("\n💡 Usage:")
    print("  • Select any text in the preview pane")
    print("  • Click 'Render as KaTeX' to manually render it")
    print("\n" + "="*60 + "\n")
    
    app.run(debug=True, port=4949, host='127.0.0.1')
