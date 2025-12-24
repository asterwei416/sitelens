import re
import os

file_path = 'src/analyzers/aiExpert.js'
# Using utf-8 encoding
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "ga4: {"
start_pos = content.find(start_marker)
if start_pos == -1:
    print("GA4 block not found")
    exit(1)

prompt_start_marker = "prompt: `# [SYSTEM_START]"
# find prompt start after ga4 block start
prompt_start_pos = content.find(prompt_start_marker, start_pos)
if prompt_start_pos == -1:
    print("Prompt start not found")
    exit(1)

# content starts after "prompt: `"
content_start_idx = prompt_start_pos + len("prompt: `")

# Use regex to find the end of the string.
# The prompt ends with a backtick that is NOT escaped, followed by some whitespace and `}` or `,`
# However, since the internal backticks are NOT escaped yet, we rely on the specific content structure at the end.
# Based on file inspection: last line is "    }" and line before is "`" (indented? probably not, usually prompt text ends then backtick)
# Step 465 shows:
# 523: `
# 524:     }
# So it is "`" followed by newline and "    }"

end_re = re.compile(r'`\s*\n\s*\}')
match = end_re.search(content, content_start_idx)

if not match:
    # Try comma
    end_re = re.compile(r'`\s*\n\s*\},')
    match = end_re.search(content, content_start_idx)

if not match:
    # Try finding the EXPLICIT end string seen in file view if possible
    # "頁面資料與可追蹤元素：\n`" (Note: I added comma in server.js but this is aiExpert.js)
    # aiExpert.js Prompt ends with backtick. 
    # Let's search for the backtick before `    }`
    # Since we know there are nested backticks, search for `    }` and go back.
    
    # Safest: Look for the closing of ga4 object
    # The ga4 object ends with `    }` and inside that block, the prompt property ends with `
    
    # Let's try to locate `EXPERT_PROMPTS` end `};`
    expert_prompts_end = content.find("};\n\n/**", start_pos)
    if expert_prompts_end == -1:
        expert_prompts_end = content.find("};\r\n\n/**", start_pos)
    
    if expert_prompts_end != -1:
        # Search backwards from there for the backtick
        # The structure is `prompt: `...` \n }`
        # So last backtick before `}` inside `ga4` block.
        pass
    
    print("Could not reliably find end of prompt.")
    # Fallback to manual string matching from previous view_file
    end_marker_str = "頁面資料與可追蹤元素：\n`"
    m_idx = content.find(end_marker_str, content_start_idx)
    if m_idx != -1:
         # The backtick is at m_idx + len(end_marker_str) - 1
         end_pos = m_idx + len(end_marker_str) - 1
         # Verify it is a backtick
         if content[end_pos] == '`':
             match = True
    
    if not match:
        exit(1)

if 'end_pos' not in locals():
    end_pos = match.start() 
    # The regex match started at the backtick.

prompt_content = content[content_start_idx:end_pos]

# Replace ` with \` only if not preceded by \
fixed_prompt = re.sub(r'(?<!\\)`', r'\\`', prompt_content)

new_content = content[:content_start_idx] + fixed_prompt + content[end_pos:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Escaped backticks in range {content_start_idx} to {end_pos}. New length diff: {len(new_content)-len(content)}")
