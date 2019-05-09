const _ = require('lodash');
const unidecode = require('unidecode');

const { VENUE_CAPACITY_RANGES } = require('../../../shared/constants');
const cityConfig = require('../../../shared/cityConfig');

/**
 * Prepare venue to be sent to client.
 * @param venue
 * @returns {*}
 */
function deserialize(venue) {
  if (venue.toObject) {
    venue = venue.toObject();
  } else {
    venue = _.cloneDeep(venue);
  }

  venue.id = venue._id;
  delete venue._id;
  delete venue.sourceId;
  delete venue.queryText;

  if (venue.images) {
    venue.images = venue.images.map(deserializeImage);
  }

  if (venue.location.coordinates) {
    const longitude = venue.location.coordinates.coordinates[0];
    const latitude = venue.location.coordinates.coordinates[1];
    venue.location.coordinates = {
      longitude,
      latitude,
    };
  }

  const cityConf = cityConfig.get(venue.location.country, venue.location.city);

  // Set computed fields
  if (venue.capacity) {
    venue.capacityRange = getCapacityRange(venue, cityConf);
  }
  if (venue.fees) {
    venue.currency = cityConf.currency;
    if (venue.fees.entrance) {
      venue.entranceFeeRange = getEntranceFeeRange(venue, cityConf);
    }
  }

  return venue;
}

function deserializeImage(venueImage) {
  if (venueImage.toObject) {
    venueImage = venueImage.toObject();
  } else {
    venueImage = _.cloneDeep(venueImage);
  }

  venueImage.id = venueImage._id;
  delete venueImage._id;

  return venueImage;
}

/**
 * Prepare venue for database insertion.
 * @param data
 * @returns {*}
 */
function serialize(data) {
  if (data.id) {
    data._id = data.id;
    delete data.id;
  }

  let cityConf;
  if (data.location && data.location.country && data.location.city) {
    cityConf = cityConfig.get(data.location.country, data.location.city);
  }

  if (data.prices && cityConf) {
    data.priceClass = getPriceClass(data, cityConf);
  }

  if (data.location && data.location.coordinates) {
    data.location.coordinates = {
      type: 'Point',
      coordinates: [
        data.location.coordinates.longitude,
        data.location.coordinates.latitude,
      ],
    };
  }

  if (!data.queryText) {
    data.queryText = unidecode(data.name);
  }

  return data;
}

function getPriceClass(venue, cityConf) {
  if (!venue.prices.coke && !venue.prices.beer) {
    return null;
  }

  const getClassForRanges = (ranges, price) =>
    ranges.reduce((range, lowerBound, index) => {
      if (range) {
        return range;
      }
      const upperBound = ranges[index + 1];
      if (!upperBound || (price > lowerBound && price <= upperBound)) {
        return index + 1;
      }
    }, null);

  const cokeClass = getClassForRanges(
    cityConf.priceClassRanges.coke,
    venue.prices.coke
  );
  const beerClass = getClassForRanges(
    cityConf.priceClassRanges.beer,
    venue.prices.beer
  );
  return Math.max(cokeClass, beerClass);
}

function getEntranceFeeRange(venue, cityConf) {
  return cityConf.entranceFeeRanges.reduce((range, lowerBound, index) => {
    if (range) {
      return range;
    }
    const upperBound = cityConf.entranceFeeRanges[index + 1];
    if (!upperBound) {
      return lowerBound;
    }
    if (venue.fees.entrance > lowerBound && venue.fees.entrance <= upperBound) {
      return [lowerBound, upperBound];
    }
  }, null);
}

function getCapacityRange(venue) {
  return VENUE_CAPACITY_RANGES.reduce((range, lowerBound, index) => {
    if (range) {
      return range;
    }
    const upperBound = VENUE_CAPACITY_RANGES[index + 1];
    if (!upperBound) {
      return lowerBound;
    }
    if (venue.capacity > lowerBound && venue.capacity <= upperBound) {
      return [lowerBound, upperBound];
    }
  }, null);
}

module.exports = {
  serialize,
  deserialize,
  deserializeImage,
};
