## Src Folder

Hosts two tools build / used for this project.

1. JSON Parser: Used for Parsing the initial GDELT Data and formatting into a format that could easily be read by Alteryx and the D3. THe toold transformed the Nodes and Edges into CSV files.
2. web_crawler: Originally we were using a Dataset that gathered news websites from the top subreddits in Reddit.com. This idea was scraped as we didn't beleive it showed anything substantial, rather than the news sites most likely to be linked. The source code used is still inside however, and utilized scrapy.py for recursively scraping each subreddit.

Both of these utilized Python3.