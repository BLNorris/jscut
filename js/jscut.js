// Copyright 2014 Todd Fleming
//
// This file is part of jscut.
//
// jscut is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// jscut is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with jscut.  If not, see <http://www.gnu.org/licenses/>.

var mainSvg = Snap("#MainSvg");
var materialSvg = Snap("#MaterialSvg");
var contentGroup = mainSvg.group();
contentGroup.attr("filter", mainSvg.filter(Snap.filter.contrast(.5)).attr("filterUnits", "objectBoundingBox"));
var combinedGeometryGroup = mainSvg.g();
var toolPathsGroup = mainSvg.g();
var selectionGroup = mainSvg.g();
var renderPath;

var svgViewModel = new SvgViewModel();
var materialViewModel = new MaterialViewModel();
var selectionViewModel = new SelectionViewModel(svgViewModel, materialViewModel, selectionGroup);
var toolModel = new ToolModel();
var operationsViewModel = new OperationsViewModel(svgViewModel, materialViewModel, selectionViewModel, toolModel, combinedGeometryGroup, toolPathsGroup);
var gcodeConversionViewModel = new GcodeConversionViewModel(materialViewModel, toolModel, operationsViewModel);

ko.applyBindings(materialViewModel, $("#Material")[0]);
ko.applyBindings(selectionViewModel, $("#CurveToLine")[0]);
ko.applyBindings(toolModel, $("#Tool")[0]);
ko.applyBindings(operationsViewModel, $("#Operations")[0]);
ko.applyBindings(operationsViewModel, $("#Operation")[0]);
ko.applyBindings(gcodeConversionViewModel, $("#GcodeConversion")[0]);
ko.applyBindings(gcodeConversionViewModel, $("#FileGetGcode")[0]);
ko.applyBindings(gcodeConversionViewModel, $("#simulatePanel")[0]);

function updateSvgAutoHeight() {
    $("svg.autoheight").each(function () {
        internalWidth = $(this).attr("internalWidth");
        internalHeight = $(this).attr("internalHeight");
        $(this).height($(this).width() * internalHeight / internalWidth);
    });
}

$(function () {
    updateSvgAutoHeight();
    $(window).resize(updateSvgAutoHeight);
});

function updateSvgSize() {
    bbox = mainSvg.getBBox();
    $("#MainSvg").attr({
        width: $("#MainSvgDiv").width(),
        height: Math.max(10, $(window).height() - 120),
        preserveAspectRatio: 'xMinYMin meet',
    });
    // attr() messes viewBox up
    $("#MainSvg").get(0).setAttribute("viewBox", (bbox.x - 2) + " " + (bbox.y - 2) + " " + (bbox.w + 4) + " " + (bbox.h + 4));
}

$(function () {
    updateSvgSize();
    $(window).resize(updateSvgSize);
});

function updateRenderPathSize() {
    $("#renderPathCanvas").attr({
        width: $("#MainSvgDiv").width(),
        height: $("#MainSvgDiv").width(),
    });
}

$(function () {
    updateRenderPathSize();
    $(window).resize(updateRenderPathSize);
    renderPath = startRenderPath($("#renderPathCanvas")[0], function () { });
});

var nextAlertNum = 1;
function showAlert(message, alerttype, haveTimeout) {
    haveTimeout = (typeof haveTimeout === "undefined") ? true : false;
    var alertNum = nextAlertNum++;
    $('#alert_placeholder').prepend('<div id="AlertNum' + alertNum + '" class="alert ' + alerttype + '"><a class="close" data-dismiss="alert">&times;</a>' + message + '</div>')
    var result = $("#AlertNum" + alertNum);
    if (haveTimeout)
        setTimeout(function () {
            result.remove();
        }, 5000);
    return result;
}

Snap.load("Material.svg", function (f) {
    materialSvg.append(f);
    materialViewModel.materialSvg(materialSvg);
});

var tutorialAlert = null;
var nextTutorialStep = 0;
function tutorial(step, message) {
    if (step >= nextTutorialStep) {
        if (tutorialAlert != null)
            tutorialAlert.remove();
        tutorialAlert = showAlert("Step " + step + ": " + message, "alert-info", false);
        nextTutorialStep = step + 1;
    }
}

tutorial(1, 'Click "Open SVG" and select an SVG file.');

function loadSvg(alert, filename, content) {
    svg = Snap.parse(content);
    contentGroup.append(svg);
    updateSvgSize();
    alert.remove();
    showAlert("loaded " + filename, "alert-success");
    tutorial(2, 'Click 1 or more objects.');
}

$(document).on('change', '#choose-svg-file', function (event) {
    var files = event.target.files;
    for (var i = 0, file; file = files[i]; ++i) {
        (function (file) {
            var alert = showAlert("loading " + file.name, "alert-info", false);
            var reader = new FileReader();
            reader.onload = function (e) {
                loadSvg(alert, file.name, e.target.result);
            };
            reader.onabort = function (e) {
                alert.remove();
                showAlert("aborted reading " + file.name, "alert-danger");
            };
            reader.onerror = function (e) {
                alert.remove();
                showAlert("error reading " + file.name, "alert-danger");
            };
            reader.readAsText(file);
        })(file);
    }
    $(event.target).replaceWith(control = $(event.target).clone(true));
});

function openSvgDropbox() {
    Dropbox.choose({
        success: function (files) {
            var alert = showAlert("loading " + files[0].name, "alert-info", false);
            $.get(files[0].link, function (content) {
                loadSvg(alert, files[0].name, content);
            }, "text").fail(function () {
                alert.remove();
                showAlert("load " + files[0].name + " failed", "alert-danger");
            });
        },
        linkType: "direct",
    });
}

$("#MainSvg").click(function (e) {
    var element = Snap.getElementByPoint(e.pageX, e.pageY);
    if (element != null) {
        operationsViewModel.clickOnSvg(element) ||
        selectionViewModel.clickOnSvg(element);
        if (selectionViewModel.selNumSelected() > 0) {
            tutorial(3, 'Click "Create Operation" after you have finished selecting objects.');
        }
    }
});

$('#pxPerInch').popover({
    trigger: "hover",
    html: true,
    content: "<table><tr><td>Inkscape:<td>90<tr><td>Adobe Illustrator:<td>72<tr><td>CorelDRAW:<td>96</table>",
    container: "body",
    placement: "right"
});

$('#createOperationButton').popover({
    trigger: "manual",
    html: true,
    content: "<p class='bg-danger'>Select 1 or more objects in the \"Edit Toolpaths\" tab before clicking here</p>",
    container: "body",
    placement: "right"
});

$('#createOperationButton').parent().hover(
    function () {
        if ($('#createOperationButton').attr("disabled"))
            $('#createOperationButton').popover('show');
    },
    function () { $('#createOperationButton').popover('hide'); });

var googleDeveloperKey = 'AIzaSyABOorNywzgSXQ8Waffle8zAhfgkHUBw0M';
var googleClientId = '103921723157-leb9b5b4i79euhnn96nlpeeev1m3pvg0.apps.googleusercontent.com';
var googleScope = ['https://www.googleapis.com/auth/drive.readonly'];
var googleAuthApiLoaded = false;
var googlePickerApiLoaded = false;
var googleDriveApiLoaded = false;
var googlePickerOauthToken;

function onGoogleApiLoad() {
    gapi.load('auth', function () { googleAuthApiLoaded = true; });
    gapi.load('picker', function () { googlePickerApiLoaded = true; });
}

function onGoogleClientLoad() {
    gapi.client.load('drive', 'v2', function () { googleDriveApiLoaded = true; });
}

function googlePickerAuth(callback) {
    if (!googleAuthApiLoaded)
        return;
    else if (googlePickerOauthToken)
        callback();
    else
        window.gapi.auth.authorize({
            'client_id': googleClientId,
            'scope': googleScope,
            'immediate': false
        }, function (authResult) {
            if (authResult && !authResult.error) {
                googlePickerOauthToken = authResult.access_token;
                callback();
            }
        });
}

function openSvgGoogle() {
    googlePickerAuth(function () {
        if (googlePickerApiLoaded && googleDriveApiLoaded && googlePickerOauthToken) {
            var picker = new google.picker.PickerBuilder().
                addView(new google.picker.DocsView(google.picker.ViewId.DOCS).
                    setQuery('*.svg')).
                enableFeature(google.picker.Feature.NAV_HIDDEN).
                setOAuthToken(googlePickerOauthToken).
                setDeveloperKey(googleDeveloperKey).
                setCallback(function (data) {
                    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
                        var doc = data[google.picker.Response.DOCUMENTS][0];
                        var name = doc[google.picker.Document.NAME];
                        //var url = doc[google.picker.Document.URL];
                        var id = doc[google.picker.Document.ID];

                        var alert = showAlert("loading " + name, "alert-info", false);

                        gapi.client.drive.files.get({
                            'fileId': id
                        }).execute(function (resp) {
                            if (resp.error) {
                                alert.remove();
                                showAlert(resp.error.message, "alert-danger");
                            } else {
                                var xhr = new XMLHttpRequest();
                                xhr.open('GET', resp.downloadUrl);
                                xhr.setRequestHeader('Authorization', 'Bearer ' + googlePickerOauthToken);
                                xhr.onload = function (content) {
                                    if (this.status == 200)
                                        loadSvg(alert, name, this.responseText);
                                    else {
                                        alert.remove();
                                        showAlert(this.statusText, "alert-danger");
                                    }
                                };
                                xhr.onerror = function () {
                                    alert.remove();
                                    showAlert("load " + name + " failed", "alert-danger");
                                };
                                xhr.overrideMimeType('text');
                                xhr.send();
                            }
                        });
                    }
                }).
                build();
            picker.setVisible(true);
        }
    });
}
