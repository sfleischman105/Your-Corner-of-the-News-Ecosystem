# -*- coding: utf-8 -*-

# Define here the models for your scraped items
#
# See documentation in:
# http://doc.scrapy.org/en/latest/topics/items.html

import scrapy


class RedditItem(scrapy.Item):
    domain = scrapy.Field()
    url = scrapy.Field()
    subreddit = scrapy.Field()
    title = scrapy.Field()
    posting_time = scrapy.Field()
    votes = scrapy.Field()
    comments = scrapy.Field()
    post_num = scrapy.Field()



    # define the fields for your item here like:
    # name = scrapy.Field()