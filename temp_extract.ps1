Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\Rajpoot Qamar Abbas\Desktop\learnflow\documentation_converted.docx')
$entry = $zip.GetEntry('word/document.xml')
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$zip.Dispose()

$text = [regex]::Replace($xml, '<[^>]+>', ' ')
$text = [regex]::Replace($text, '\s+', ' ').Trim()

# Search for progress-related content
$keywords = @('progress', 'completion', 'complete', 'completed', 'last visited', 'resume', 'lessonprogress', 'courseprogress')
$sentences = $text -split '[.!?\r\n]+'
foreach ($s in $sentences) {
    $lower = $s.Trim().ToLower()
    foreach ($kw in $keywords) {
        if ($lower.Contains($kw)) {
            Write-Output $s.Trim()
            Write-Output '---'
            break
        }
    }
}
