from flask import Blueprint, request, Response, jsonify
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin, quote

proxy_bp = Blueprint('proxy', __name__)

# Common headers to mimic a real browser
BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}


@proxy_bp.route('/proxy', methods=['GET'])
def proxy_webpage():
    """
    Proxy endpoint for full page viewing.
    Fetches a webpage and rewrites links to stay within the proxy.
    """
    url = request.args.get('url')
    if not url:
        return Response("Missing URL parameter", status=400)
    
    try:
        # Fetch the content
        resp = requests.get(url, headers=BROWSER_HEADERS, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        
        # Get content type
        content_type = resp.headers.get('Content-Type', 'text/html')
        
        # If it's not HTML, just stream it back (images, css, js, etc.)
        if 'text/html' not in content_type:
            response = Response(resp.content, content_type=content_type)
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response
        
        # Parse HTML
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Get the base URL for resolving relative links
        base_url = resp.url  # Use final URL after redirects
        parsed_base = urlparse(base_url)
        origin = f"{parsed_base.scheme}://{parsed_base.netloc}"
        
        # Remove existing <base> tags to avoid conflicts
        for existing_base in soup.find_all('base'):
            existing_base.decompose()
        
        # Inject new <base> tag for resources (CSS, images, etc.)
        if soup.head:
            base_tag = soup.new_tag('base', href=origin + '/')
            soup.head.insert(0, base_tag)
        
        # Rewrite navigation links to go through proxy
        for tag in soup.find_all('a'):
            if tag.has_attr('href'):
                href = tag['href']
                if href and not href.startswith('#') and not href.startswith('javascript:') and not href.startswith('mailto:'):
                    full_url = urljoin(base_url, href)
                    # URL encode the target URL
                    tag['href'] = f"/api/proxy?url={quote(full_url, safe='')}"
                    # Remove target="_blank" to keep navigation in iframe
                    if tag.has_attr('target'):
                        del tag['target']
        
        # Rewrite form actions
        for form in soup.find_all('form'):
            if form.has_attr('action'):
                action = form['action']
                if action:
                    full_url = urljoin(base_url, action)
                    form['action'] = f"/api/proxy?url={quote(full_url, safe='')}"
            else:
                # Forms without action submit to current page
                form['action'] = f"/api/proxy?url={quote(base_url, safe='')}"
        
        # Inject a script to handle dynamic navigation and vocabulary selection
        inject_script = soup.new_tag('script')
        inject_script.string = """
        (function() {
            // Handle clicks on dynamically created links
            document.addEventListener('click', function(e) {
                var target = e.target.closest('a');
                if (target && target.href && !target.href.startsWith('/api/proxy')) {
                    var href = target.href;
                    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                        e.preventDefault();
                        window.location.href = '/api/proxy?url=' + encodeURIComponent(href);
                    }
                }
            }, true);
            
            // Vocabulary selection feature
            function extractSentence(text, selectedWord) {
                if (!text || !selectedWord) return text;
                // Simple sentence extraction - find sentence containing the word
                var sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                for (var i = 0; i < sentences.length; i++) {
                    if (sentences[i].toLowerCase().indexOf(selectedWord.toLowerCase()) !== -1) {
                        return sentences[i].trim();
                    }
                }
                return text.substring(0, 300);
            }
            
            function getContextText(node) {
                // Walk up the DOM to find a meaningful container
                var current = node;
                while (current && current !== document.body) {
                    if (current.nodeType === 1) {
                        var tag = current.tagName.toLowerCase();
                        if (tag === 'p' || tag === 'div' || tag === 'article' || tag === 'section' || tag === 'li') {
                            return current.textContent || '';
                        }
                    }
                    current = current.parentNode;
                }
                return node.textContent || '';
            }
            
            // Listen for text selection
            document.addEventListener('mouseup', function(e) {
                // Small delay to ensure selection is complete
                setTimeout(function() {
                    var selection = window.getSelection();
                    if (!selection || selection.toString().trim() === '') return;
                    
                    var selectedText = selection.toString().trim();
                    
                    // Only process short selections (1-5 words)
                    var wordCount = selectedText.split(/\\s+/).length;
                    if (wordCount > 5 || selectedText.length > 100) return;
                    
                    // Get position
                    var range = selection.getRangeAt(0);
                    var lastRange = range.cloneRange();
                    var rect = range.getBoundingClientRect();
                    
                    // Get context for sentence extraction
                    var container = range.commonAncestorContainer;
                    var contextText = getContextText(container);
                    var sentence = extractSentence(contextText, selectedText);
                    
                    // Store for scroll tracking
                    window.__vocabLastRange = lastRange;

                    // Send to parent frame
                    if (window.parent !== window) {
                        window.parent.postMessage({
                            type: 'vocab-selection',
                            word: selectedText,
                            sentence: sentence,
                            x: rect.left + rect.width / 2,
                            y: rect.bottom
                        }, '*');
                    }
                }, 50);
            });

            // Track scroll to keep popup anchored
            var scrollTicking = false;
            window.addEventListener('scroll', function() {
                if (scrollTicking) return;
                scrollTicking = true;
                window.requestAnimationFrame(function() {
                    if (window.parent !== window && window.__vocabLastRange) {
                        var rect = window.__vocabLastRange.getBoundingClientRect();
                        if (rect && rect.width !== 0 && rect.height !== 0) {
                            window.parent.postMessage({
                                type: 'vocab-scroll',
                                x: rect.left + rect.width / 2,
                                y: rect.bottom
                            }, '*');
                        }
                    }
                    scrollTicking = false;
                });
            }, { passive: true });
        })();
        """
        if soup.body:
            soup.body.append(inject_script)
        
        # Return modified content
        modified_content = str(soup)
        
        response = Response(modified_content, content_type='text/html; charset=utf-8')
        # Remove headers that block iframe embedding
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['X-Frame-Options'] = 'ALLOWALL'
        return response

    except requests.exceptions.Timeout:
        return Response("Request timed out", status=504)
    except requests.exceptions.RequestException as e:
        return Response(f"Error fetching URL: {str(e)}", status=502)
    except Exception as e:
        return Response(f"Error processing page: {str(e)}", status=500)


@proxy_bp.route('/proxy/reader', methods=['GET'])
def proxy_reader():
    """
    Reader mode endpoint.
    Extracts article content from a webpage for clean reading.
    """
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'Missing URL parameter'}), 400
    
    try:
        # Try to use newspaper3k for article extraction
        try:
            from newspaper import Article
            
            article = Article(url)
            article.download()
            article.parse()
            
            # Get article data
            title = article.title or 'Untitled'
            content = article.text or ''
            authors = article.authors
            publish_date = article.publish_date
            top_image = article.top_image
            
            # Convert plain text to HTML paragraphs
            if content:
                paragraphs = content.split('\n\n')
                content_html = ''.join([f'<p>{p.strip()}</p>' for p in paragraphs if p.strip()])
            else:
                content_html = '<p>Could not extract article content.</p>'
            
            return jsonify({
                'title': title,
                'content': content_html,
                'author': ', '.join(authors) if authors else None,
                'date': publish_date.strftime('%B %d, %Y') if publish_date else None,
                'image': top_image if top_image else None,
                'url': url
            })
            
        except ImportError:
            # Fallback: Use BeautifulSoup for basic extraction
            resp = requests.get(url, headers=BROWSER_HEADERS, timeout=15)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.content, 'html.parser')
            
            # Try to find the title
            title = None
            if soup.title:
                title = soup.title.string
            if not title:
                h1 = soup.find('h1')
                if h1:
                    title = h1.get_text(strip=True)
            title = title or 'Untitled'
            
            # Try to find article content
            # Look for common article containers
            article_selectors = [
                'article',
                '[role="main"]',
                '.article-content',
                '.post-content',
                '.entry-content',
                '.content',
                'main',
                '#content',
            ]
            
            content_elem = None
            for selector in article_selectors:
                content_elem = soup.select_one(selector)
                if content_elem:
                    break
            
            if not content_elem:
                # Fallback to body
                content_elem = soup.body
            
            if content_elem:
                # Remove unwanted elements
                for unwanted in content_elem.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'form', '.ad', '.advertisement', '.sidebar']):
                    unwanted.decompose()
                
                # Get paragraphs
                paragraphs = content_elem.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote'])
                content_html = ''.join([str(p) for p in paragraphs])
            else:
                content_html = '<p>Could not extract article content.</p>'
            
            # Try to find featured image
            og_image = soup.find('meta', property='og:image')
            image = og_image['content'] if og_image and og_image.has_attr('content') else None
            
            return jsonify({
                'title': title,
                'content': content_html,
                'author': None,
                'date': None,
                'image': image,
                'url': url
            })
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Error fetching URL: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'error': f'Error extracting content: {str(e)}'}), 500
