import zipfile, re, sys

z = zipfile.ZipFile('documentation_converted.docx')
xml = z.read('word/document.xml').decode('utf-8')
text = re.sub(r'<[^>]+>', ' ', xml)

# Extract paragraphs
paragraphs = re.findall(r'<w:p[^>]*>(.*?)</w:p>', xml, re.DOTALL)
for p in paragraphs:
    # Extract text content from paragraph
    text_content = re.sub(r'<[^>]+>', '', p).strip()
    text_content = re.sub(r'\s+', ' ', text_content)
    if text_content and any(w in text_content.lower() for w in ['progress', 'completion', 'complete', 'completed', 'last visited', 'resume', 'lessonprogress', 'courseprogress']):
        print(text_content[:300])
        print('---')
