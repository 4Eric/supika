const fs = require('fs');
const content = fs.readFileSync('frontend/src/views/EventDetail.vue', 'utf8');

const scanTags = (html) => {
    const stack = [];
    let state = 0;
    let currentTag = '';
    let isClosing = false;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < html.length; i++) {
        const c = html[i];
        
        switch (state) {
            case 0:
                if (c === '<') {
                    if (html[i+1] === '/') {
                        isClosing = true;
                        i++;
                    } else {
                        isClosing = false;
                    }
                    state = 1;
                    currentTag = '';
                }
                break;
            case 1:
                if (c === '>' || c === ' ' || c === '\n') {
                    if (currentTag && !currentTag.startsWith('!')) {
                        if (isClosing) {
                            if (stack.length > 0) {
                                const last = stack.pop();
                                if (last.tag !== currentTag) {
                                    console.log(`Mismatch at index ${i}: expected </${last.tag}> but found </${currentTag}>. Open tag was at index ${last.index}`);
                                    return;
                                }
                            } else {
                                console.log(`Extra closing tag </${currentTag}> at index ${i}`);
                                return;
                            }
                        } else {
                            // Check if self-closing by looking ahead for />
                            let j = i;
                            let selfClosing = false;
                            while (html[j] !== '>') {
                                if (html[j] === '"' || html[j] === "'") {
                                    let quote = html[j];
                                    j++;
                                    while (html[j] !== quote && j < html.length) j++;
                                }
                                if (html[j] === '/' && html[j+1] === '>') selfClosing = true;
                                j++;
                                if (j >= html.length) break;
                            }
                            if (!selfClosing && !['img', 'input', 'br', 'hr', 'source', 'EventMap'].includes(currentTag)) {
                                stack.push({tag: currentTag, index: i});
                            }
                        }
                    }
                    if (c === '>') state = 0;
                    else state = 2; // In attributes
                } else {
                    currentTag += c;
                }
                break;
            case 2:
                if (c === '"' || c === "'") {
                    inString = !inString;
                } else if (!inString && c === '>') {
                    if (html[i-1] === '/') {
                        // It was self closing, pop
                        stack.pop();
                    }
                    state = 0;
                }
                break;
        }
    }
};

const template = content.substring(content.indexOf('<template>'), content.lastIndexOf('</template>') + 11);
scanTags(template);
