# -*- coding: utf-8 -*-

# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: http://doc.scrapy.org/en/latest/topics/item-pipeline.html
import json
from scrapy.exporters import JsonLinesItemExporter
import re

class RedditScraperPipeline(object):
    def process_item(self, item, spider):
        item['title'] = item['title'][0]
        item['comments'] = int(re.match(r'([0-9]+).*comments.*', item['comments'][0]).group(1))
        item['post_num'] = int(item['post_num'][0])
        item['posting_time'] = item['posting_time'][0]
        item['subreddit'] = item['subreddit'][0]
        item['url'] = item['url'][0]
        item['domain'] = item['domain'][0]
        item['votes'] = int(item['votes'][0])
        return item


class JsonWriterPipeline(object):

    def __init__(self):
        self.file = open('top_posts.json', 'w+b')

    def spider_opened(self, spider):
        self.exporter = JsonLinesItemExporter(self.file)
        self.exporter.start_exporting()

    def spider_closed(self, spider):
        self.exporter.finish_exporting()
        self.file.close()

    def process_item(self, item, spider):
        JsonLinesItemExporter(self.file).export_item(item)
        return item
