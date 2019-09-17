---
title: Synchronizing your Hierarchical Data with Merkle Tree
date: "2019-03-14T23:46:37.121Z"
template: "post"
draft: false
slug: "/posts/hierarchical-data-synchronization-merkle-tree/"
category: "Tech Writeup"
tags:
  - "Redux"
  - "Django"
description: "If you haven’t noticed it already, this data structure called tree that you came across in that one computer science class turns out to be everywhere."
socialImage: /media/2019-03-14--merkle-tree/merkle.png
---

You’re searching for that uninstaller of a game you installed years ago and forgot to play? The filesystem is a tree. You’re drilling down the options you have to replace your old earphone in one of the million e-commerce website out there? The category is a tree. You know what, this website is also a tree since HTML is a tree. Heck, even your whole family is a tree! …sorry, I meant to say that your family tree is a tree. Anyway, we’re living in a world of trees!

Since we’re living in a world of trees, it wouldn’t be rare to find that we need to work on a data represented as a tree, or we can also call it as a hierarchical data.
You see, all of my past internships were done in two startups, and both have this kind of hierarchy in their product category:

![Hierarchical category in STOQO.com](/media/2019-03-14--merkle-tree/stoqo-category.png)

![Hierarchical category in Dekoruma.com](/media/2019-03-14--merkle-tree/dekoruma-category.png)

In one case it’s up to three level and represented as an actual tree, and in another it’s just two level and represented as nested tabs.
Let’s take an example: in a grocery store app, a *banana* 🍌 might be placed under the hierarchical category of: Foods > Fruits > Yellow Fruits. So let’s see how we can store it.

There’s a lot of way to store hierarchical data, one way might be by storing its parent:

```json
[
    {
        "id": 1,
        "category": "Foods",
        "parent": null
    },
    {
        "id": 2,
        "category": "Fruits",
        "parent": 1
    },
    {
        "id": 3,
        "category": "Yellow Fruits",
        "parent": 2
    }
]
```

Another might be to store its children instead:

```json
[
    {
        "id": 1,
        "category": "Foods",
        "children": [ 2 ],
    },
    {
        "id": 2,
        "category": "Fruits",
        "children": [ 3 ]
    },
    {
        "id": 3,
        "category": "Yellow Fruits",
        "children": []
    }
]
```

Or even flattened with a `path` attribute:

```json
[
    {
        "category": "Foods",
        "path": "Foods"
    },
    {
        "category": "Fruits",
        "path": "Foods > Fruits"
    },
    {
        "category": "Yellow Fruits",
        "path": "Foods > Fruits > Yellow Fruits"
    }
]
```

And there’s a lot more way to store this data with their own pros and cons. While it’s an interesting topic (and you should read that link), this article is not about that, so let’s skip it.

These category should not be changed much, right? So why would we request it again and again if it won’t change much? Isn’t it be better to persist them in something like a `localStorage` in web or `AsyncStorage` in mobile? Well it's even more important if the app is supposed to be offline-first, as is often the case in PWA and mobile app. Fortunately if you're using redux, there's an awesome [redux-persist](https://github.com/rt2zz/redux-persist) library that will take care of persisting the data for you. Check it out if you haven't.

Now with that in place, we’re doing less request and our app became even faster. Our server is happy, our user is happy, we’re happy. But wait. The merchandising team came to you asking why their new, shiny 🥑 *Really-green Fruits* category is not shown on the customer app, and thus recategorized fruits’ sales plummeted. Oh no, we have persisted the whole category and not bother requesting it again to the server since we think it won’t change anyway.

A quick fix will be to just request the whole category again on refresh, for example. But this defeats the purpose of storing the category tree, and requesting the whole tree is pretty expensive, like something something megabytes expensive. We can also request the subtree, level-by-level every time the user browse to a subcategory. Let’s assume an average level would have about five nodes, each nodes averaging in 200 bytes of data, this would consume an additional kilobyte for every request, considering the added round trip to the server, this might take around 200 ms. As a tech interviewer would say, can we do better?

Let me introduce Merkle Tree.

![Merkle Tree, From Wikipedia](/media/2019-03-14--merkle-tree/merkle.png)


Merkle Tree is a special kind of tree. It is a hash-based data structure, popularized by its use in the cryptocurrency field, such as its use by Satoshi Nakamoto in Bitcoin. Well, a quick google about merkle tree will result mostly in its application in cryptocurrency. But instead we’ll use this hip data structure for our hierarchical category, how cool is that.

Basically, the leaf in a merkle tree stores the hash of the associated data. Then the parent will take the hashes of its children and hashes it. This repeats to the top until we get the hash for the root node. This way, a change in a data somewhere down the tree will reflects to its parents, and the has in the root node will always change.

Cool, so how can we apply it to our app? In our case, when the merchandising team decided to create a new category under the Fruits category, the hash of Fruits will change and thus the hash of Foods will change and thus the hash of our root will change. This way, our app can just check if the hash of the root changes to decide if we should sync our category.

A simple implementation for storing and calculating the hash will be something like this (in Django):

```python
class Category(models.Model):
    # ...
    hash = models.CharField(max_length=64)

    def get_hash(self):
        SEPARATOR = b"\x00\x00"
        h = hashlib.sha256()
        h.update(str(self).encode())
        for child in self.children.all():
            h.update(SEPARATOR)
            h.update(child.hash.encode())
        return h.hexdigest()

    def save(self, *args, **kwargs):
        self.hash = self.get_hash()
        super().save(*args, **kwargs)
        if self.parent:
            self.parent.save()
```

For every insertion/update, we need an additional trip for the depth of the node. In our case it will only be two or three levels deep.

While the implementation for the app will be something like this (with Redux Thunk):

```js

export const syncCategories = categories => async (dispatch, getState, { api, schema }) => {
    try {
        const state = getState();
        const currentCategories = selectCategories(state, categories);
        const remote = await api.getCategories({ categories, depth: 0 });
        const diff = remote.filter((tree, idx) => tree.hash !== currentCategories[idx].hash);
        const { entities } = normalize(diff, [schema.category]);
        dispatch(addEntities(entities));
        const subCategories = [].concat(...diff.map(tree => tree.children));
        if (subCategories.length > 0) {
            dispatch(syncCategories(subCategories));
        }
    } catch (err) {
        console.error(err);
    }
};
```

This way, we can only request for syncCategories([rootCategoryId]) once, maybe on every refresh, or just occasionally (you know, it's not changing much after all). Then if it's detect that the has is different (see that filter thingy) we recurse to its children, only going down if the hash is also different.

That’s it, we don’t have to request the whole category tree and only updates those that really change. And with that, our merchandising time is also happy, our user is seeing the recategorized products again, and the product sales is coming back up again. Now we can live happily ever after.
