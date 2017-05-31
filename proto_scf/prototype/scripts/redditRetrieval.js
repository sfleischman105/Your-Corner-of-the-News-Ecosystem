/**
 * Created by bking on 5/31/17.
 */

function topKByDomain(domain, k, callback) {
    var result = [];
    function parseDomainPage(domainPage) {
        for (var i = 0; i < Math.min(k, domainPage.data.children.length); i++) {
            var article = domainPage.data.children[i];
            result.push({
                title: article.data.title,
                link: article.data.url,
                subreddit: article.data.subreddit
            });
        }
        callback(result);
    }
    jQuery.getJSON("https://www.reddit.com/domain/" + domain + "/.json", parseDomainPage);

}