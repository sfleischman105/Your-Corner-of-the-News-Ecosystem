


This script crawls over the top all-time ranked posts in the subreddits specified by subreddits.txt inside `/spiders/`. 
Each subreddit is sorted by all-time votes and each post is scraped. Posts not linking to an external site or linking to a 
domain in the `banned_domains` list inside of reddit_scraper are scraped for information. 
The number of posts to scrape can be set inside of the spider, with the `NUMBER_POSTS` variable.

Requirements:
 - Python 3.5.3
 - Packages scrapy.py (use `pip install scrapy`)

***

To run, navigate to `reddit_scraper/spiders/`
type in the following command  `scrapy crawl reddit` in the console

Returned export should be in `reddit_scraper/spiders/top_posts.csv`

Exported CSV has the following fields per each post scraped:  
`domain` ------------ Domain linked to  
`url` ---------------- Exact URL   
`subreddit` -------- Subreddit originated from   
`title` ------------- Title of the post  
`posting_time` --- Time when the post was submitted  
`votes` ------------- Number of total votes received  
`comments` --------- Number of comments on the post  
`post_num` --------- 'Rank' of the post in the subreddit 