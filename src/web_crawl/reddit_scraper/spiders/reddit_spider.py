# Utilizing Scrapy.py, runs through subreddits located inside subreddits.txt
# exports raw HTML files into the ./sites folder
#
# Currently has the ability to go into deeper pages of reddit, up to a
# custom amount
#
# In the future will be able to directly extract <div>s and their associated
# information for stuff like: link, upvotes, etc.
#

import scrapy
import re

# noinspection PyUnresolvedReferences,PyUnresolvedReferences,PyUnresolvedReferences
from reddit_scraper.items import RedditItem

# domains to be avoided, will discard any of the posts which link to these sites
# Mostly for non-news sites and sites sharing images
banned_domains = [
        'i.imgur.com',
        'imgur.com',
        'i.redd.it',
        'i.sli.mg',
        'i.reddituploads.com',
        'youtube.com',
        'reddit.com',
        'np.reddit.com',
        'm.imgur.com',
        'youtu.be',
        'archive.is',
        'i.magaimg.net',
        'sli.mg',
        's-media-cache-ak0.pinimg.com',
        'quickmeme.com',
        '24.media.tumblr.com',
        'pbs.twimg.com',
        ''
    ]

# Number of posts To parse per subreddit
NUMBER_POSTS = 1750


class RedditSpider(scrapy.Spider):
    # Basic variables, name of the Spider + Sites allowed
    name = "reddit"
    allowed_domains = ["www.reddit.com"]

    # write file for future additions concerning exporting data
    write_sites = open("subreddits_exp.txt","w")

    # Function to start scraping, calls Parse in each site to examine HTML contents
    def start_requests(self):
        urls = subreddits_scraped()
        for url in urls:
            yield scrapy.Request(url=url, callback=self.parse)

    # Operations to be perfomed once HTML is received
    def parse(self, response):

        # Count variable serves to count number of posts skimmed so far
        count = 0
        last = response.url.split("/")[-1]
        num_posts = re.match(r'.*count=([0-9]+).*', last)

        # Checks to see if regex matches a number, if so parses number and puts into 'count'
        if num_posts:
            count = int(num_posts.group(1))

        # next_page is the next page for the scraper to follow
        next_page = response.css('span.next-button a::attr(href)').extract_first()

        # selects all posts in the page
        selector_list = response.css('div.thing')

        # runs through each post
        for selector in selector_list:
            # gets subreddit and domain the post links to
            subreddit = selector.xpath('@data-subreddit').extract()
            domain = selector.xpath('@data-domain').extract()

            # checks to make sure the post is a link to an external site AND if its not in the list of
            # banned linking domains
            if "self." + subreddit[0] != domain[0] and domain[0] not in banned_domains:
                # Grabs all the content it needs thorugh css and html selectors
                item = RedditItem()
                item['domain'] = domain
                item['url'] = selector.xpath('@data-url').extract()
                item['subreddit'] = subreddit
                item['title'] = selector.xpath('div/p/a/text()').extract()
                item['posting_time'] = selector.xpath('@data-timestamp').extract()
                item['votes'] = selector.xpath('div[@class="midcol unvoted"]/div[@class="score likes"]/@title').extract()
                item['comments'] = selector.xpath('div[@class="entry unvoted"]/ul/li/a/text()').extract()
                item['post_num'] = selector.xpath('@data-rank').extract()
                # 'Returns' item to be processed by pipelines.py
                yield item

        # checks to make sure next link is valid AND it isn't past the limit of posts to scrape
        if next_page is not None and count <= NUMBER_POSTS:
            yield scrapy.Request(str(next_page), callback=self.parse)


# Function to return list of URLS from designated subreddits from subreddits.txt
def subreddits_scraped():
    base = "https://www.reddit.com/r/"
    top = "/top/?sort=top&t=all"
    subreddits_list = open('subreddits.txt', "r")
    domains = []
    for line in subreddits_list:
        domains.append(base + line.strip() + top)
    return domains


