# from bs4 import BeautifulSoup
import scrapy
from scrapy.contrib.linkextractors import LinkExtractor
import re



class RedditSpider(scrapy.Spider):
    name = "reddit"
    allowed_domains = ["www.reddit.com"]

    write_sites = open("subreddits_exp.txt","w")


    def start_requests(self):
        urls = subreddits_scraped()
        for url in urls:
            yield scrapy.Request(url=url, callback=self.parse)

    def parse(self, response):
        site_table = response.css('div.siteTable')
        posts = []
        # for div in site_table:
        #     if
        #
        #
        # for post in response.css('div.siteTable '):


        page = response.url.split("/")[-3]
        count = 0

        last = response.url.split("/")[-1]
        num_posts = re.match(r'.*count=([0-9]+).*', last)
        print(num_posts)
        if num_posts:
            count = int(num_posts.group(1))

        self.log('Count %s',count)

        next_page = response.css('span.next-button a::attr(href)').extract_first()

        filename = ('sites/reddit-%s-%s.html' % (page, count))
        with open(filename, 'wb') as f:
            f.write(response.body)

        if next_page is not None and count <= 200:
            yield scrapy.Request(str(next_page), callback=self.parse)



def subreddits_scraped():
    base = "https://www.reddit.com/r/"
    top = "/top/?sort=top&t=all"
    subreddits_list = open('subreddits.txt', "r")
    domains = []
    for line in subreddits_list:
        domains.append(base + line.strip() + top)
    return domains


#<span class="next-button"> <a href="https...."></a> next

