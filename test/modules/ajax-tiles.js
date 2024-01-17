/* global QUnit, $, testLog */

(function() {
    var viewer;

    // These values are generated by a script that concatenates all the tile files and records
    // their byte ranges in a multi-dimensional array.

    // eslint-disable-next-line
    var tileManifest  = {"tileRanges":[[[[0,3467]]],[[[3467,6954]]],[[[344916,348425]]],[[[348425,351948]]],[[[351948,355576]]],[[[355576,359520]]],[[[359520,364663]]],[[[364663,374196]]],[[[374196,407307]]],[[[407307,435465],[435465,463663]],[[463663,491839],[491839,520078]]],[[[6954,29582],[29582,50315],[50315,71936],[71936,92703]],[[92703,113385],[113385,133265],[133265,154763],[154763,175710]],[[175710,197306],[197306,218807],[218807,242177],[242177,263007]],[[263007,283790],[283790,304822],[304822,325691],[325691,344916]]]],"totalSize":520078}

    function getTileRangeHeader(level, x, y) {
        return 'bytes=' + tileManifest.tileRanges[level][x][y].join('-') + '/' + tileManifest.totalSize;
    }

    // This tile source demonstrates how you can retrieve individual tiles from a single file
    // using the Range header.
    var customTileSource = {
        width: 1000,
        height: 1000,
        tileWidth: 254,
        tileHeight: 254,
        tileOverlap: 1,
        maxLevel: 10,
        minLevel: 0,
        // The tile URL is always the same. Only the Range header changes
        getTileUrl: function () {
            return '/test/data/testpattern.blob';
        },
        // This method will send the appropriate range header for this tile based on the data
        // in tileByteRanges.
        getTileAjaxHeaders: function(level, x, y) {
            return {
                Range: getTileRangeHeader(level, x, y)
            };
        },
    };

    QUnit.module('AJAX-Tiles', {
        beforeEach: function() {
            $('<div id="example"></div>').appendTo('#qunit-fixture');

            testLog.reset();

            viewer = OpenSeadragon({
                id: 'example',
                prefixUrl: '/build/openseadragon/images/',
                springStiffness: 100, // Faster animation = faster tests,
                loadTilesWithAjax: true,
                ajaxHeaders: {
                    'X-Viewer-Header': 'ViewerHeaderValue'
                }
            });
        },
        afterEach: function() {
            if (viewer){
                let errors = viewer.drawer._numGlMaxTextureErrors;
                if(errors > 0){
                    console.log('Number of times MAX_TEXTURE_IMAGE_UNITS had a bad value:', errors);
                }
                viewer.destroy();
            }

            viewer = null;
        }
    });

    QUnit.test('tile-loaded event includes AJAX request object', function(assert) {
        var done = assert.async();
        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            assert.ok(evt.tileRequest, 'Event includes tileRequest property');
            assert.equal(evt.tileRequest.readyState, XMLHttpRequest.DONE, 'tileRequest is in completed state');
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);
        viewer.open(customTileSource);
    });

    QUnit.test('withCredentials is set in tile AJAX requests', function(assert) {
        var done = assert.async();
        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            assert.ok(evt.tileRequest, 'Event includes tileRequest property');
            assert.equal(evt.tileRequest.readyState, XMLHttpRequest.DONE, 'tileRequest is in completed state');
            assert.equal(evt.tileRequest.withCredentials, true, 'withCredentials is set in tile request');
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);
        viewer.addTiledImage({
            tileSource: customTileSource,
            ajaxWithCredentials: true
        });
    });

    QUnit.test('tile-load-failed event includes AJAX request object', function(assert) {
        var done = assert.async();
        // Create a tile source that points to a broken URL
        var brokenTileSource = OpenSeadragon.extend({}, customTileSource, {
            getTileUrl: function () {
                return '/test/data/testpattern.blob.invalid';
            }
        });

        var tileLoadFailed = function tileLoadFailed(evt) {
            viewer.removeHandler('tile-load-failed', tileLoadFailed);
            assert.ok(evt.tileRequest, 'Event includes tileRequest property');
            assert.equal(evt.tileRequest.readyState, XMLHttpRequest.DONE, 'tileRequest is in completed state');
            done();
        };

        viewer.addHandler('tile-load-failed', tileLoadFailed);
        viewer.open(brokenTileSource);
    });

    QUnit.test('Headers can be set per-tile', function(assert) {
        var done = assert.async();
        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            var tile = evt.tile;
            assert.ok(tile, 'tile property exists on event');
            assert.ok(tile.ajaxHeaders, 'Tile has ajaxHeaders property');
            assert.equal(tile.ajaxHeaders.Range, getTileRangeHeader(tile.level, tile.x, tile.y), 'Tile has correct range header.');
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);
        viewer.open(customTileSource);
    });

    QUnit.test('Headers are propagated correctly', function(assert) {
        var done = assert.async();
        // Create a tile source that sets a static header for tiles
        var staticHeaderTileSource = OpenSeadragon.extend({}, customTileSource, {
            getTileAjaxHeaders: function() {
                return {
                    'X-Tile-Header': 'TileHeaderValue'
                };
            }
        });

        var expectedHeaders = {
            'X-Viewer-Header': 'ViewerHeaderValue',
            'X-TiledImage-Header': 'TiledImageHeaderValue',
            'X-Tile-Header': 'TileHeaderValue'
        };

        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            var tile = evt.tile;
            assert.ok(tile, 'tile property exists on event');
            assert.ok(tile.ajaxHeaders, 'Tile has ajaxHeaders property');
            assert.deepEqual(
                tile.ajaxHeaders, expectedHeaders,
                'Tile headers include headers set on Viewer and TiledImage'
            );
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);

        viewer.addTiledImage({
            ajaxHeaders: {
                'X-TiledImage-Header': 'TiledImageHeaderValue'
            },
            tileSource: staticHeaderTileSource
        });
    });

    QUnit.test('Viewer headers are overwritten by TiledImage', function(assert) {
        var done = assert.async();
        // Create a tile source that sets a static header for tiles
        var staticHeaderTileSource = OpenSeadragon.extend({}, customTileSource, {
            getTileAjaxHeaders: function() {
                return {
                    'X-Tile-Header': 'TileHeaderValue'
                };
            }
        });

        var expectedHeaders = {
            'X-Viewer-Header': 'ViewerHeaderValue-Overwritten',
            'X-TiledImage-Header': 'TiledImageHeaderValue',
            'X-Tile-Header': 'TileHeaderValue'
        };

        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            var tile = evt.tile;
            assert.ok(tile, 'tile property exists on event');
            assert.ok(tile.ajaxHeaders, 'Tile has ajaxHeaders property');
            assert.deepEqual(
                tile.ajaxHeaders, expectedHeaders,
                'TiledImage header overwrites viewer header'
            );
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);

        viewer.addTiledImage({
            ajaxHeaders: {
                'X-TiledImage-Header': 'TiledImageHeaderValue',
                'X-Viewer-Header': 'ViewerHeaderValue-Overwritten'
            },
            tileSource: staticHeaderTileSource
        });
    });

    QUnit.test('TiledImage headers are overwritten by Tile', function(assert) {
        var done = assert.async();

        var expectedHeaders = {
            'X-Viewer-Header': 'ViewerHeaderValue',
            'X-TiledImage-Header': 'TiledImageHeaderValue-Overwritten',
            'X-Tile-Header': 'TileHeaderValue'
        };

        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            var tile = evt.tile;
            assert.ok(tile, 'tile property exists on event');
            assert.ok(tile.ajaxHeaders, 'Tile has ajaxHeaders property');
            assert.deepEqual(
                tile.ajaxHeaders, expectedHeaders,
                'Tile header overwrites TiledImage header'
            );
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);

        // Create a tile source that sets a static header for tiles
        var staticHeaderTileSource = OpenSeadragon.extend({}, customTileSource, {
            getTileAjaxHeaders: function() {
                return {
                    'X-TiledImage-Header': 'TiledImageHeaderValue-Overwritten',
                    'X-Tile-Header': 'TileHeaderValue'
                };
            }
        });

        viewer.addTiledImage({
            ajaxHeaders: {
                'X-TiledImage-Header': 'TiledImageHeaderValue'
            },
            tileSource: staticHeaderTileSource
        });
    });

    QUnit.test('Viewer headers can be updated', function(assert) {
        var done = assert.async();

        var newHeaders = {
            'X-Viewer-Header': 'ViewerHeaderValue-Updated',
            'X-Viewer-Header2': 'ViewerHeaderValue2'
        }
        var newHeaders2 = {
            Range: 'test',
        }

        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            // set new Viewer headers and propagate to TiledImage and Tile
            viewer.setAjaxHeaders(newHeaders);
            viewer.addHandler('tile-loaded', tileLoaded2);
        };

        var tileLoaded2 = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded2);
            assert.deepEqual(viewer.ajaxHeaders, newHeaders);
            assert.deepEqual(evt.tiledImage.ajaxHeaders, newHeaders);
            assert.deepEqual(
                evt.tile.ajaxHeaders,
                OpenSeadragon.extend(
                    {}, viewer.ajaxHeaders, evt.tiledImage.ajaxHeaders,
                    { Range: getTileRangeHeader(evt.tile.level, evt.tile.x, evt.tile.y) }
                )
            );
            // set new Viewer headers and propagate to TiledImage and Tile
            viewer.setAjaxHeaders(newHeaders2, true);
            viewer.addHandler('tile-loaded', tileLoaded3);
        };

        var tileLoaded3 = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded3);
            assert.deepEqual(viewer.ajaxHeaders, newHeaders2);
            assert.deepEqual(evt.tiledImage.ajaxHeaders, newHeaders2);
            assert.equal(evt.tile.ajaxHeaders['X-Viewer-Header'], undefined);
            assert.equal(evt.tile.ajaxHeaders['X-Viewer-Header2'], undefined);
            // 'Range' header entry set per tile and must not be overwritten by Viewer header
            assert.equal(evt.tile.ajaxHeaders.Range, getTileRangeHeader(evt.tile.level, evt.tile.x, evt.tile.y));
            // set new Viewer headers but do not propagate to TiledImage and Tile
            viewer.setAjaxHeaders(newHeaders, false);
            viewer.addHandler('tile-loaded', tileLoaded4);
        };

        var tileLoaded4 = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded4);
            assert.deepEqual(viewer.ajaxHeaders, newHeaders);
            assert.deepEqual(evt.tiledImage.ajaxHeaders, newHeaders2);
            assert.equal(evt.tile.ajaxHeaders['X-Viewer-Header'], undefined);
            assert.equal(evt.tile.ajaxHeaders['X-Viewer-Header2'], undefined);
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);
        viewer.open(customTileSource);
    });

    QUnit.test('TiledImage headers can be updated', function(assert) {
        var done = assert.async();

        var tileSourceHeaders = {
            'X-Tile-Header': 'TileHeaderValue'
        }
        var newHeaders = {
            'X-TiledImage-Header': 'TiledImageHeaderValue-Updated',
            'X-TiledImage-Header2': 'TiledImageHeaderValue2'
        }
        var newHeaders2 = {
            'X-Viewer-Header': 'ViewerHeaderValue-Updated',
            'X-Tile-Header': 'TileHeaderValue-Updated'
        }

        var tileLoaded = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded);
            // set new TiledImage headers and propagate to Tile
            evt.tiledImage.setAjaxHeaders(newHeaders);
            viewer.addHandler('tile-loaded', tileLoaded2);
        };

        var tileLoaded2 = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded2);
            assert.deepEqual(viewer.ajaxHeaders, { 'X-Viewer-Header': 'ViewerHeaderValue' });
            assert.deepEqual(evt.tiledImage._ownAjaxHeaders, newHeaders);
            assert.deepEqual(evt.tiledImage.ajaxHeaders, OpenSeadragon.extend({}, viewer.ajaxHeaders, newHeaders));
            assert.deepEqual(evt.tile.ajaxHeaders, OpenSeadragon.extend({}, viewer.ajaxHeaders, newHeaders, tileSourceHeaders));
            // set new TiledImage headers (that overwrite header entries of Viewer and Tile) and propagate to Tile
            evt.tiledImage.setAjaxHeaders(newHeaders2, true);
            viewer.addHandler('tile-loaded', tileLoaded3);
        };

        var tileLoaded3 = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded3);
            assert.deepEqual(viewer.ajaxHeaders, { 'X-Viewer-Header': 'ViewerHeaderValue' });
            assert.deepEqual(evt.tiledImage._ownAjaxHeaders, newHeaders2);
            assert.deepEqual(evt.tiledImage.ajaxHeaders, OpenSeadragon.extend({}, viewer.ajaxHeaders, newHeaders2));
            assert.deepEqual(evt.tile.ajaxHeaders, OpenSeadragon.extend({}, viewer.ajaxHeaders, newHeaders2, tileSourceHeaders));
            // set new TiledImage headers but do not propagate to Tile
            evt.tiledImage.setAjaxHeaders(null, false);
            viewer.addHandler('tile-loaded', tileLoaded4);
        };

        var tileLoaded4 = function tileLoaded(evt) {
            viewer.removeHandler('tile-loaded', tileLoaded4);
            assert.deepEqual(viewer.ajaxHeaders, { 'X-Viewer-Header': 'ViewerHeaderValue' });
            assert.deepEqual(evt.tiledImage._ownAjaxHeaders, {});
            assert.deepEqual(evt.tiledImage.ajaxHeaders, viewer.ajaxHeaders);
            assert.deepEqual(evt.tile.ajaxHeaders, OpenSeadragon.extend({}, viewer.ajaxHeaders, newHeaders2, tileSourceHeaders));
            done();
        };

        viewer.addHandler('tile-loaded', tileLoaded);
        viewer.addTiledImage({
            ajaxHeaders: {
                'X-TiledImage-Header': 'TiledImageHeaderValue'
            },
            tileSource: OpenSeadragon.extend({}, customTileSource, {
                getTileAjaxHeaders: function() {
                    return tileSourceHeaders;
                }
            }),
        });
    });
})();
