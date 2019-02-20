/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Write your transction processor functions here
 */
let ROOT_NAMESPACE = "org.dasp.net";
let AUTHOR = ROOT_NAMESPACE + ".Author";
let REVISION = ROOT_NAMESPACE + ".Revision";
let ARTICLE = ROOT_NAMESPACE + ".Article";

/**
 * Bootstrap various objects for convenience.
 *
 * @param {org.dasp.net.Bootstrap} bootstrap -- Bootstrap transaction
 * @transaction
 */
function onBootstrap(bootstrap) {
  let authors = [];
  let reviewers = [];
  let articles = [];
  let factory = getFactory();

  // Create Author
  let bossman = factory.newResource(
    ROOT_NAMESPACE,
    "Author",
    "autor0@email.com"
  );
  bossman.firstName = "André";
  bossman.lastName = "Defrémont";
  bossman.isReviewer = false;
  authors.push(bossman);

  // Create Reviewers
  let mr_incredible = factory.newResource(
    ROOT_NAMESPACE,
    "Author",
    "revisor0@email.com"
  );
  mr_incredible.firstName = "Bob";
  mr_incredible.lastName = "Parr";
  mr_incredible.isReviewer = true;
  authors.push(mr_incredible);

  let gecko = factory.newResource(
    ROOT_NAMESPACE,
    "Author",
    "revisor1@email.com"
  );
  gecko.firstName = "Gecko";
  gecko.lastName = "Geico";
  gecko.isReviewer = true;
  authors.push(gecko);

  let duck = factory.newResource(
    ROOT_NAMESPACE,
    "Author",
    "revisor2@email.com"
  );
  duck.firstName = "Duck";
  duck.lastName = "Aflac";
  duck.isReviewer = true;
  authors.push(duck);

  let peyton = factory.newResource(
    ROOT_NAMESPACE,
    "Author",
    "revisor3@email.com"
  );
  peyton.firstName = "Peyton";
  peyton.lastName = "Manning";
  peyton.isReviewer = true;
  authors.push(peyton);

  let alfred = factory.newResource(
    ROOT_NAMESPACE,
    "Author",
    "revisor4@email.com"
  );
  alfred.firstName = "Alfred";
  alfred.lastName = "Pennyworth";
  alfred.isReviewer = true;
  authors.push(alfred);

  // Create Articles
  let bossmanForeignKey = factory.newRelationship(
    ROOT_NAMESPACE,
    "Author",
    "autor0@email.com"
  );

  let a1 = factory.newResource(ROOT_NAMESPACE, "Article", "artigo0");
  a1.hash = "hash_IPFS_1";
  a1.tags = "tags for article";
  a1.author = bossmanForeignKey;
  a1.date = bootstrap.timestamp;
  a1.revisions = [];
  articles.push(a1);

  let bossmanForeignKey2 = factory.newRelationship(
    ROOT_NAMESPACE,
    "Author",
    "revisor0@email.com"
  );

  let r1 = factory.newResource(ROOT_NAMESPACE, "Revision", "revisao0");
  r1.hash = "hashIPFS";
  r1.notes = "notes";
  r1.revisionType = "HALFBLIND";
  r1.reviewer = bossmanForeignKey2;
  r1.date = bootstrap.timestamp;

  return getParticipantRegistry(AUTHOR)
    .then(function(authorRegistry) {
      return authorRegistry.addAll(authors);
    })
    .then(function() {
      return getAssetRegistry(REVISION);
    })
    .then(function(revisionRegistry) {
      return revisionRegistry.add(r1);
    })
    .then(function() {
      return getAssetRegistry(ARTICLE);
    })
    .then(function(articleRegistry) {
      return articleRegistry.addAll(articles);
    })
    .catch(function(error) {
      console.log(error);
      throw error;
    });
}

/**
 * Change Article Hash
 * @param {org.dasp.net.NewHash} NewHash
 * @transaction
 */
async function newHash(NewHash) {
  // Save the old value of the hash.
  const oldHash = NewHash.article.hash;

  // Update the hash with the new value.
  NewHash.article.hash = NewHash.newHash;

  NewHash.article.points = 0;
  NewHash.article.revCount = 0;
  NewHash.article.needRev = false;

  // Get the asset registry for the asset.
  const articleRegistry = await getAssetRegistry(ARTICLE);
  // Update the asset in the asset registry.
  await articleRegistry.update(NewHash.article);

  // Emit an event for the modified asset.
  let event = getFactory().newEvent("org.dasp.net", "NewHashEvent");
  event.article = NewHash.article;
  event.oldHash = oldHash;
  event.newHash = NewHash.newHash;
  emit(event);
}
/**
 * creates an revisions with article and reviewer
 * @param {org.dasp.net.CreateRevision} createRevision
 * @transaction
 */

async function CreateRevision(createRevision) {
  let revisors = [];
  let revisions = [];
  let count = 0;
  let factory = getFactory();
  let reviewers = [];
  let participantRegistry = await getParticipantRegistry(AUTHOR);
  // Get all of the drivers in the driver participant registry.
  let authors = await participantRegistry.getAll();
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  const articleRegistry = await getAssetRegistry(ARTICLE);
  let revs = await revisionRegistry.getAll();
  if (createRevision.article.revisions.length >= 5) {
    // If article of revision already have 5 revisors
    createRevision.article.revisions.forEach(function(revision) {
      revs.forEach(rev => {
        if (
          JSON.stringify(rev.revisionId) === JSON.stringify(revision.revisionId)
        ) {
          console.log("FOUND: " + rev);
          reviewers.push(rev.reviewer);
        }
      });
    });
    for (let i = 0; i < 5; i++) {
      // Get each revisor of article and create news revisions for each of them
      revisions[i] = factory.newResource(
        ROOT_NAMESPACE,
        "Revision",
        createRevision.transactionId + i
      );
      revisions[i].hash = createRevision.article.hash;
      revisions[i].notes = "notes";
      revisions[i].revisionType = "HALFBLIND";
      revisions[i].reviewer = reviewers[i];
      revisions[i].date = createRevision.timestamp;
      revisions[i].article = createRevision.article;
      console.log("revision added: " + revisions[i]);
    }
    createRevision.article.revisions = revisions;

    await articleRegistry.update(createRevision.article);
    return getAssetRegistry(REVISION)
      .then(function(revisionRegistry) {
        return revisionRegistry.addAll(revisions);
      })
      .catch(function(error) {
        console.log(error);
        throw error;
      });
  } else {
    // Else (if article has not 5 revisors) For each author, check if is reviewer.
    authors.forEach(function(author) {
      if (author.isReviewer) {
        console.log("REVISOR TRUE " + author.email);
        // Push reviewer in revisors array
        revisors.push(author);
        console.log("revisor");
        count++;
      }
    });
    // Get random numbers from list of revisors
    function randomNumbers(max) {
      function range(upTo) {
        var result = [];
        for (var i = 0; i < upTo; i++) result.push(i);
        return result;
      }
      function shuffle(o) {
        // Shuffle list to get randomic top 5
        for (
          var j, x, i = o.length;
          i;
          j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x
        );
        return o;
      }
      var myArr = shuffle(range(max));
      return function() {
        return myArr.shift();
      };
    }
    var randoms = randomNumbers(revisors.length),
      rand = randoms(),
      result = [];
    while (rand != null) {
      result.push(rand);
      rand = randoms();
    }

    console.log(result);
    // For each chosen reviewer, create a revision
    const articleRegistry = await getAssetRegistry(ARTICLE);
    for (let i = 0; i < 5; i++) {
      reviewers.push(
        factory.newRelationship(
          ROOT_NAMESPACE,
          "Author",
          revisors[result[i]].email
        )
      );
      console.log("random num: " + result[i]);
      console.log(revisors[result[i]]);

      revisions[i] = factory.newResource(
        ROOT_NAMESPACE,
        "Revision",
        createRevision.transactionId + i
      );
      revisions[i].hash = createRevision.article.hash;
      revisions[i].notes = "#";
      revisions[i].revisionType = "FULLBLIND";
      revisions[i].reviewer = reviewers[i];
      revisions[i].date = createRevision.timestamp;
      revisions[i].article = createRevision.article;
      console.log("rev:" + revisions[i]);
      createRevision.article.revisions.push(revisions[i]);
      // Update the asset in the asset registry.
    }
    await articleRegistry.update(createRevision.article);

    return getAssetRegistry(REVISION)
      .then(function(revisionRegistry) {
        return revisionRegistry.addAll(revisions);
      })
      .catch(function(error) {
        console.log(error);
        throw error;
      });
  }
} // Send e-mail needed here after transaction CreateRevision

/**
 * Transaction to POSITIVE decision of reviewer about ACCEPT or NOT ACCEPT to take the revision
 * @param {org.dasp.net.ReviewAccept} reviewAccept
 * @transaction
 */

async function ReviewAccept(reviewAccept) {
  // Update the revision acc atribute with 'true' value.
  reviewAccept.revision.acc = true;
  reviewAccept.revision.date = reviewAccept.timestamp;

  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(reviewAccept.revision);
}

/**
 * Transaction to NEGATIVE decision of reviewer about ACCEPT or NOT ACCEPT to take the revision
 * @param {org.dasp.net.ReviewRejected} reviewRejected
 * @transaction
 */

async function ReviewRejected(reviewRejected) {
  // Update the asset with the new value.
  let revisors = [];
  let count = 0;
  let factory = getFactory();
  // Get the driver participant registry.
  let participantRegistry = await getParticipantRegistry(AUTHOR);
  // Get all of the drivers in the driver participant registry.
  let authors = await participantRegistry.getAll();
  // Get all the reviewers to chosen the new one
  authors.forEach(function(author) {
    if (author.isReviewer) {
      console.log("REVISOR TRUE " + author.email);
      revisors.push(author);
      console.log("revisor");
      count++;
    }
  });
  // Verification needed in the case of get a same reviewer
  let randRevisor = Math.floor(Math.random() * (count - 0 + 1) + 0);
  console.log("random num:" + randRevisor);
  console.log(revisors[randRevisor].email);
  let reviewer = factory.newRelationship(
    ROOT_NAMESPACE,
    "Author",
    revisors[randRevisor].email
  );
  reviewRejected.revision.acc = false;
  reviewRejected.revision.reviewer = reviewer;
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(reviewRejected.revision);
}
/**
 * Transaction for rating of revision
 * @param {org.dasp.net.RateRevision} rateRevision
 * @transaction
 */

async function RateRevision(rateRevision) {
  // Update the asset with the new value.
  // If the reviewer accept the article, sum 1 to atributte acc's.
  rateRevision.revision.notes = rateRevision.notes;
  rateRevision.revision.points = rateRevision.points;
  rateRevision.revision.complete = true;
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(rateRevision.revision);
  // If the article already reach the maximum of 5 rated revisions
    // Get the asset registry for the asset.
    const articleRegistry = await getAssetRegistry(ARTICLE);
    rateRevision.revision.article.points += rateRevision.revision.points / 5;
      // Calculate average points of article
      rateRevision.revision.article.revCount += 1;
    // Update the asset in the asset registry.
    await articleRegistry.update(rateRevision.revision.article);
    // If article reach 6 or more points
    if(rateRevision.revision.article.revCount >= 5){
      if (rateRevision.revision.article.points >= 6) {
        // Publish the article
        rateRevision.revision.article.published = true;
        // Author turns in Reviewer
        rateRevision.revision.article.author.isReviewer = true;
        // Get the asset registry for the asset.
        const authorRegistry = await getParticipantRegistry(AUTHOR);
        // Update the asset in the asset registry.
        rateRevision.revision.article.needRev = false;
        await authorRegistry.update(rateRevision.revision.article.author);
        // Update the asset in the asset registry.
        await articleRegistry.update(rateRevision.revision.article);
      } else {
        // Else (if the article reaches 6 or more points, but it was not accepted by the majority.)
        // Need other revision of sames revisors.
        rateRevision.revision.article.needRev = true;
        // Update the asset in the asset registry.
        await articleRegistry.update(rateRevision.revision.article);
      }

    }
  
}

/**
 * Transaction for submit new Article
 * @param {org.dasp.net.NewArticle} newArticle
 * @transaction
 */

async function NewArticle(newArticle) {
  let article;
  let factory = getFactory();
  // Create new resource (Article)
  article = factory.newResource(
    ROOT_NAMESPACE,
    "Article",
    newArticle.transactionId
  );

  // Update the new asset with values.
  article.hash = newArticle.hash;
  article.paid = newArticle.paid;
  article.tags = newArticle.tags;
  article.author = getCurrentParticipant();
  article.date = newArticle.timestamp;
  article.revisions = [];

  return getAssetRegistry(ARTICLE)
    .then(function(articleRegistry) {
      return articleRegistry.add(article);
    })
    .catch(function(error) {
      console.log(error);
      throw error;
    });
}
/**
 * Transaction for new Author, maybe not needed
 * @param {org.dasp.net.NewAuthor} newAuthor
 * @transaction
 */

async function NewAuthor(newAuthor) {
  let participantRegistry = await getParticipantRegistry(AUTHOR);
  let author;
  let factory = getFactory();
  author = factory.newResource(ROOT_NAMESPACE, "Author", newAuthor.email);

  // Update the asset with the new value.
  author.email = newAuthor.email;
  author.firstName = newAuthor.firstName;
  author.lastName = newAuthor.lastName;
  author.authorId = newAuthor.transactionId;
  let authors = await participantRegistry.getAll();
    if (authors.length < 5) {
      author.isReviewer = true;
    }
  return getParticipantRegistry(AUTHOR)
    .then(function(authorRegistry) {
      return authorRegistry.add(author);
    })
    .catch(function(error) {
      console.log(error);
      throw error;
    });
}
